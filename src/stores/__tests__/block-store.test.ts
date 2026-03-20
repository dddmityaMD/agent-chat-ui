/**
 * Tests for Zustand block store (Phase 49-01, Task 2)
 *
 * Covers: upsert, remove, getBlocksByLevel, getAllBlocksSorted,
 * switchThread, hydrateFromSummary, applyBlockUpdate (D-18)
 */

import { useBlockStore } from "../block-store";
import type { PanelBlock, BlockUpdateEvent } from "@/lib/panel-blocks/types";

function makeBlock(overrides: Partial<PanelBlock> = {}): PanelBlock {
  return {
    id: "test-block",
    type: "test",
    level: "l2",
    data: {},
    priority: 0.5,
    state: "populated",
    updatedAt: 1000,
    ...overrides,
  };
}

describe("useBlockStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useBlockStore.setState({ threadId: null, blocks: {} });
  });

  describe("upsertBlock", () => {
    it("adds a new block", () => {
      const block = makeBlock({ id: "entity-map" });
      useBlockStore.getState().upsertBlock(block);

      const blocks = useBlockStore.getState().blocks;
      expect(blocks["entity-map"]).toBeDefined();
      expect(blocks["entity-map"].id).toBe("entity-map");
    });

    it("updates existing block with same id", () => {
      const block = makeBlock({ id: "entity-map", priority: 0.5 });
      useBlockStore.getState().upsertBlock(block);

      const updated = makeBlock({
        id: "entity-map",
        priority: 0.9,
        data: { entities: [] },
      });
      useBlockStore.getState().upsertBlock(updated);

      const blocks = useBlockStore.getState().blocks;
      expect(Object.keys(blocks)).toHaveLength(1);
      expect(blocks["entity-map"].priority).toBe(0.9);
    });

    it("sets updatedAt on every upsert", () => {
      const block = makeBlock({ id: "test", updatedAt: 0 });
      const before = Date.now();
      useBlockStore.getState().upsertBlock(block);
      const after = Date.now();

      const stored = useBlockStore.getState().blocks["test"];
      expect(stored.updatedAt).toBeGreaterThanOrEqual(before);
      expect(stored.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("removeBlock", () => {
    it("removes a block by id", () => {
      useBlockStore.getState().upsertBlock(makeBlock({ id: "to-remove" }));
      expect(useBlockStore.getState().blocks["to-remove"]).toBeDefined();

      useBlockStore.getState().removeBlock("to-remove");
      expect(useBlockStore.getState().blocks["to-remove"]).toBeUndefined();
    });

    it("is a no-op for non-existent id", () => {
      useBlockStore.getState().removeBlock("does-not-exist");
      expect(Object.keys(useBlockStore.getState().blocks)).toHaveLength(0);
    });
  });

  describe("getBlocksByLevel", () => {
    it("filters blocks by SA level", () => {
      useBlockStore.getState().upsertBlock(makeBlock({ id: "a", level: "l2" }));
      useBlockStore.getState().upsertBlock(makeBlock({ id: "b", level: "l3" }));
      useBlockStore.getState().upsertBlock(makeBlock({ id: "c", level: "l2" }));

      const l2 = useBlockStore.getState().getBlocksByLevel("l2");
      expect(l2).toHaveLength(2);
      expect(l2.every((b) => b.level === "l2")).toBe(true);
    });

    it("sorts by priority descending", () => {
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "low", level: "l2", priority: 0.2 }));
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "high", level: "l2", priority: 0.9 }));
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "mid", level: "l2", priority: 0.5 }));

      const l2 = useBlockStore.getState().getBlocksByLevel("l2");
      expect(l2[0].id).toBe("high");
      expect(l2[1].id).toBe("mid");
      expect(l2[2].id).toBe("low");
    });
  });

  describe("getActionBlocks", () => {
    it("returns only action-level blocks", () => {
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "plan", level: "action" }));
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "entity", level: "l2" }));

      const actions = useBlockStore.getState().getActionBlocks();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("plan");
    });
  });

  describe("getAllBlocksSorted", () => {
    it("groups by SA_LEVEL_ORDER then sorts by priority within group", () => {
      useBlockStore
        .getState()
        .upsertBlock(
          makeBlock({ id: "l3-block", level: "l3", priority: 0.9 }),
        );
      useBlockStore
        .getState()
        .upsertBlock(
          makeBlock({ id: "action-block", level: "action", priority: 0.5 }),
        );
      useBlockStore
        .getState()
        .upsertBlock(
          makeBlock({ id: "l1-block", level: "l1", priority: 0.7 }),
        );
      useBlockStore
        .getState()
        .upsertBlock(
          makeBlock({ id: "l2-high", level: "l2", priority: 0.8 }),
        );
      useBlockStore
        .getState()
        .upsertBlock(
          makeBlock({ id: "l2-low", level: "l2", priority: 0.3 }),
        );

      const sorted = useBlockStore.getState().getAllBlocksSorted();
      const ids = sorted.map((b) => b.id);
      // action first, then l1, then l2 (high before low), then l3
      expect(ids).toEqual([
        "action-block",
        "l1-block",
        "l2-high",
        "l2-low",
        "l3-block",
      ]);
    });
  });

  describe("switchThread", () => {
    it("clears all blocks and sets new threadId", () => {
      useBlockStore
        .getState()
        .upsertBlock(makeBlock({ id: "stale-block" }));
      expect(
        Object.keys(useBlockStore.getState().blocks).length,
      ).toBeGreaterThan(0);

      useBlockStore.getState().switchThread("new-thread-123");

      expect(useBlockStore.getState().threadId).toBe("new-thread-123");
      expect(Object.keys(useBlockStore.getState().blocks)).toHaveLength(0);
    });

    it("accepts null to clear thread", () => {
      useBlockStore.getState().switchThread("thread-1");
      useBlockStore.getState().switchThread(null);
      expect(useBlockStore.getState().threadId).toBeNull();
    });
  });

  describe("hydrateFromSummary", () => {
    it("populates blocks from REST thread summary data", () => {
      const summary = {
        entities: [
          { name: "orders", type: "table", confidence: 0.9, resolved: true },
        ],
        evidence: [
          {
            source: "postgres",
            tool_name: "postgres_query",
            finding: "12 cols",
            quality_flag: "high",
          },
        ],
      };

      useBlockStore.getState().hydrateFromSummary("thread-abc", summary);

      const state = useBlockStore.getState();
      expect(state.threadId).toBe("thread-abc");
      expect(state.blocks["entity-map"]).toBeDefined();
      expect(state.blocks["entity-map"].level).toBe("l2");
      expect(state.blocks["evidence-collection"]).toBeDefined();
      expect(state.blocks["evidence-collection"].level).toBe("l2");
    });

    it("does not create blocks for empty summary fields", () => {
      useBlockStore.getState().hydrateFromSummary("thread-xyz", {});
      const state = useBlockStore.getState();
      expect(state.threadId).toBe("thread-xyz");
      expect(Object.keys(state.blocks)).toHaveLength(0);
    });
  });

  describe("applyBlockUpdate (D-18)", () => {
    it("creates block on upsert action", () => {
      const event: BlockUpdateEvent = {
        block_id: "data-profile",
        sa_level: "l2",
        action: "upsert",
        data: { columns: [{ name: "id", type: "int", null_rate: 0, cardinality: 100 }] },
        source_tool: "describe_columns",
      };

      useBlockStore.getState().applyBlockUpdate(event);

      const block = useBlockStore.getState().blocks["data-profile"];
      expect(block).toBeDefined();
      expect(block.level).toBe("l2");
      expect(block.state).toBe("populated");
      expect(block.type).toBe("data-profile");
    });

    it("updates existing block on upsert action", () => {
      // First upsert
      useBlockStore.getState().applyBlockUpdate({
        block_id: "entity-map",
        sa_level: "l2",
        action: "upsert",
        data: { entities: [{ name: "orders", type: "table", confidence: 0.8, resolved: true }] },
      });

      // Second upsert with merged data
      useBlockStore.getState().applyBlockUpdate({
        block_id: "entity-map",
        sa_level: "l2",
        action: "upsert",
        data: { entities: [{ name: "users", type: "table", confidence: 0.9, resolved: true }] },
      });

      const block = useBlockStore.getState().blocks["entity-map"];
      expect(block).toBeDefined();
      // Data should be from the latest event
      const data = block.data as Record<string, unknown>;
      expect(data.entities).toBeDefined();
    });

    it("removes block on remove action", () => {
      // Add a block first
      useBlockStore.getState().upsertBlock(makeBlock({ id: "agent-status", level: "l1" }));

      useBlockStore.getState().applyBlockUpdate({
        block_id: "agent-status",
        sa_level: "l1",
        action: "remove",
        data: {},
      });

      expect(useBlockStore.getState().blocks["agent-status"]).toBeUndefined();
    });
  });

  describe("updateBlockData", () => {
    it("merges partial data into existing block", () => {
      useBlockStore.getState().upsertBlock(
        makeBlock({ id: "evidence", data: { count: 3 } }),
      );

      useBlockStore.getState().updateBlockData("evidence", { count: 5, newField: "value" });

      const block = useBlockStore.getState().blocks["evidence"];
      const data = block.data as Record<string, unknown>;
      expect(data.count).toBe(5);
      expect(data.newField).toBe("value");
    });

    it("is a no-op for non-existent block", () => {
      useBlockStore.getState().updateBlockData("ghost", { x: 1 });
      expect(useBlockStore.getState().blocks["ghost"]).toBeUndefined();
    });
  });
});
