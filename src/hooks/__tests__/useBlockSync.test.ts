/**
 * Tests for useBlockSync SSE event routing logic (Phase 49-05).
 *
 * Tests the pure routing functions directly (no React context needed).
 * The hook itself wires these into useEffect + stream events.
 */

import {
  routeBlockUpdateEvent,
  routeToolResultEvent,
  routeSubagentStarted,
  routeSubagentFinished,
  routeActionResolution,
  hydrateBlocksFromSaisUi,
  type BlockSyncActions,
} from "../useBlockSync";

// ---------------------------------------------------------------------------
// Mock BlockSyncActions for capturing calls
// ---------------------------------------------------------------------------

function createMockActions(): BlockSyncActions & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    upsertBlock: (...args: unknown[]) => {
      calls.push({ method: "upsertBlock", args });
    },
    removeBlock: (...args: unknown[]) => {
      calls.push({ method: "removeBlock", args });
    },
    applyBlockUpdate: (...args: unknown[]) => {
      calls.push({ method: "applyBlockUpdate", args });
    },
    switchThread: (...args: unknown[]) => {
      calls.push({ method: "switchThread", args });
    },
  } as unknown as BlockSyncActions & {
    calls: { method: string; args: unknown[] }[];
  };
}

// ---------------------------------------------------------------------------
// block_update event (D-18 primary path)
// ---------------------------------------------------------------------------

describe("routeBlockUpdateEvent", () => {
  it("calls applyBlockUpdate with event data", () => {
    const actions = createMockActions();
    const eventData = {
      block_id: "entity-map",
      sa_level: "l2",
      action: "upsert",
      data: { entities: [{ name: "users", type: "table" }] },
    };

    routeBlockUpdateEvent(eventData, actions);

    expect(actions.calls).toHaveLength(1);
    expect(actions.calls[0].method).toBe("applyBlockUpdate");
    expect(actions.calls[0].args[0]).toEqual(eventData);
  });
});

// ---------------------------------------------------------------------------
// tool_result routing via TOOL_BLOCK_MAP (v1 fallback)
// ---------------------------------------------------------------------------

describe("routeToolResultEvent", () => {
  it("upserts entity-map block for resolve_entity tool", () => {
    const actions = createMockActions();
    routeToolResultEvent(
      "resolve_entity",
      { name: "users", type: "table", score: 0.95 },
      actions,
    );

    expect(actions.calls).toHaveLength(1);
    expect(actions.calls[0].method).toBe("upsertBlock");
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "entity-map",
      type: "entity-map",
      level: "l2",
      state: "populated",
    });
  });

  it("does not upsert for unknown tool", () => {
    const actions = createMockActions();
    routeToolResultEvent("some_random_tool", {}, actions);

    expect(actions.calls).toHaveLength(0);
  });

  it("upserts evidence-collection block for postgres_query", () => {
    const actions = createMockActions();
    routeToolResultEvent(
      "postgres_query",
      { row_count: 42 },
      actions,
    );

    expect(actions.calls).toHaveLength(1);
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "evidence-collection",
      type: "evidence-collection",
      level: "l2",
    });
  });

  it("upserts plan-approval action block for submit_plan", () => {
    const actions = createMockActions();
    routeToolResultEvent(
      "submit_plan",
      { goal: "Create table", steps: [] },
      actions,
    );

    expect(actions.calls).toHaveLength(1);
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "plan-approval",
      level: "action",
    });
  });
});

// ---------------------------------------------------------------------------
// Subagent lifecycle
// ---------------------------------------------------------------------------

describe("routeSubagentStarted", () => {
  it("upserts L1 agent-status block", () => {
    const actions = createMockActions();
    routeSubagentStarted("investigation", 15, actions);

    expect(actions.calls).toHaveLength(1);
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "agent-status",
      type: "agent-status",
      level: "l1",
      state: "loading",
    });
    expect((block.data as Record<string, unknown>).subagent_id).toBe(
      "investigation",
    );
  });
});

describe("routeSubagentFinished", () => {
  it("removes L1 agent-status block", () => {
    const actions = createMockActions();
    routeSubagentFinished(actions);

    expect(actions.calls.some((c) => c.method === "removeBlock")).toBe(true);
    const removeCall = actions.calls.find((c) => c.method === "removeBlock");
    expect(removeCall?.args[0]).toBe("agent-status");
  });
});

// ---------------------------------------------------------------------------
// Action-to-decision-record lifecycle (D-10)
// ---------------------------------------------------------------------------

describe("routeActionResolution", () => {
  it("removes plan-approval block and upserts decision-record on plan_approved", () => {
    const actions = createMockActions();
    routeActionResolution("plan_approved", { decision: "Create staging table" }, actions);

    // Should have 2 calls: removeBlock + upsertBlock
    expect(actions.calls).toHaveLength(2);

    const removeCall = actions.calls.find((c) => c.method === "removeBlock");
    expect(removeCall?.args[0]).toBe("plan-approval");

    const upsertCall = actions.calls.find((c) => c.method === "upsertBlock");
    const block = upsertCall?.args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "decision-record",
      type: "decision-record",
      level: "l2",
    });
    const data = block.data as Record<string, unknown>;
    expect(data.action).toBe("approved");
    expect(data.decision).toBe("Create staging table");
    expect(typeof data.resolvedAt).toBe("string");
  });

  it("removes plan-approval and creates rejected decision-record on plan_rejected", () => {
    const actions = createMockActions();
    routeActionResolution(
      "plan_rejected",
      { decision: "Rejected plan", details: "Need more research" },
      actions,
    );

    const upsertCall = actions.calls.find((c) => c.method === "upsertBlock");
    const data = (upsertCall?.args[0] as Record<string, unknown>)
      .data as Record<string, unknown>;
    expect(data.action).toBe("rejected");
    expect(data.details).toBe("Need more research");
  });

  it("removes entity-disambiguation and creates selected decision-record on entity_selected", () => {
    const actions = createMockActions();
    routeActionResolution(
      "entity_selected",
      { decision: "public.users" },
      actions,
    );

    const removeCall = actions.calls.find((c) => c.method === "removeBlock");
    expect(removeCall?.args[0]).toBe("entity-disambiguation");

    const upsertCall = actions.calls.find((c) => c.method === "upsertBlock");
    const data = (upsertCall?.args[0] as Record<string, unknown>)
      .data as Record<string, unknown>;
    expect(data.action).toBe("selected");
    expect(data.decision).toBe("public.users");
  });
});

// ---------------------------------------------------------------------------
// sais_ui hydration (backward compat fallback)
// ---------------------------------------------------------------------------

describe("hydrateBlocksFromSaisUi", () => {
  it("hydrates evidence-collection from sais_ui.evidence", () => {
    const actions = createMockActions();
    hydrateBlocksFromSaisUi(
      {
        evidence: [
          { source: "pg", tool_name: "postgres_query", finding: "Found data", quality_flag: "ok" },
        ],
      },
      actions,
    );

    expect(actions.calls).toHaveLength(1);
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "evidence-collection",
      type: "evidence-collection",
      level: "l2",
    });
  });

  it("hydrates entity-map from sais_ui.grounded_entities", () => {
    const actions = createMockActions();
    hydrateBlocksFromSaisUi(
      {
        grounded_entities: [
          { canonical_key: "table:users", name: "users" },
        ],
      },
      actions,
    );

    expect(actions.calls).toHaveLength(1);
    const block = actions.calls[0].args[0] as Record<string, unknown>;
    expect(block).toMatchObject({
      id: "entity-map",
      type: "entity-map",
      level: "l2",
    });
  });

  it("does not hydrate blocks when sais_ui is empty", () => {
    const actions = createMockActions();
    hydrateBlocksFromSaisUi({}, actions);
    expect(actions.calls).toHaveLength(0);
  });
});
