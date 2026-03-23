/**
 * useBlockSync — SSE event routing to block store (Phase 49-05).
 *
 * Wires SSE events (tool_called, tool_result, subagent_started, subagent_finished,
 * block_update) to the Zustand block store. Also handles backward-compat
 * sais_ui hydration.
 *
 * Primary path (D-18): block_update events from backend -> store.applyBlockUpdate()
 * V1 fallback: TOOL_BLOCK_MAP routing -> store.upsertBlock()
 */

import { useEffect, useRef, useCallback, startTransition } from "react";
import { useBlockStore } from "@/stores/block-store";
import { TOOL_BLOCK_MAP } from "@/lib/panel-blocks/constants";
import type { PanelBlock, BlockUpdateEvent } from "@/lib/panel-blocks/types";
import type { Message } from "@langchain/langgraph-sdk";

// ---------------------------------------------------------------------------
// BlockSyncActions interface (testable without React)
// ---------------------------------------------------------------------------

export interface BlockSyncActions {
  upsertBlock: (block: PanelBlock) => void;
  removeBlock: (id: string) => void;
  applyBlockUpdate: (event: BlockUpdateEvent) => void;
  switchThread: (threadId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Pure routing functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * D-18 primary path: route block_update SSE event directly to store.
 */
export function routeBlockUpdateEvent(
  eventData: unknown,
  actions: BlockSyncActions,
): void {
  actions.applyBlockUpdate(eventData as BlockUpdateEvent);
}

/**
 * V1 fallback: route tool_result via TOOL_BLOCK_MAP lookup.
 */
export function routeToolResultEvent(
  toolName: string,
  resultData: Record<string, unknown>,
  actions: BlockSyncActions,
): void {
  const mapping =
    TOOL_BLOCK_MAP[toolName as keyof typeof TOOL_BLOCK_MAP];
  if (!mapping) return;

  actions.upsertBlock({
    id: mapping.blockId,
    type: mapping.blockId,
    level: mapping.level,
    data: resultData,
    priority: 0.5,
    state: "populated",
    updatedAt: Date.now(),
  });
}

/**
 * Upsert L1 agent-status block on subagent start.
 */
export function routeSubagentStarted(
  subagentId: string,
  maxIterations: number,
  actions: BlockSyncActions,
): void {
  actions.upsertBlock({
    id: "agent-status",
    type: "agent-status",
    level: "l1",
    data: {
      subagent_id: subagentId,
      iteration: { current: 0, max: maxIterations },
    },
    priority: 1.0,
    state: "loading",
    updatedAt: Date.now(),
  });
}

/**
 * Remove L1 agent-status block on subagent finish.
 */
export function routeSubagentFinished(actions: BlockSyncActions): void {
  actions.removeBlock("agent-status");
}

/**
 * Action-to-decision-record lifecycle (D-10).
 * Removes the action block, upserts an L2 decision-record.
 */
export function routeActionResolution(
  eventType: "plan_approved" | "plan_rejected" | "entity_selected",
  eventData: Record<string, unknown>,
  actions: BlockSyncActions,
): void {
  const blockIdToRemove =
    eventType === "entity_selected"
      ? "entity-disambiguation"
      : "plan-approval";

  const actionValue: "approved" | "rejected" | "selected" =
    eventType === "plan_approved"
      ? "approved"
      : eventType === "plan_rejected"
        ? "rejected"
        : "selected";

  actions.removeBlock(blockIdToRemove);
  actions.upsertBlock({
    id: "decision-record",
    type: "decision-record",
    level: "l2",
    data: {
      decision: eventData.decision ?? "",
      action: actionValue,
      ...(eventData.details ? { details: eventData.details } : {}),
      resolvedAt: new Date().toISOString(),
    },
    priority: 0.6,
    state: "complete",
    updatedAt: Date.now(),
  });
}

/**
 * Backward-compat: hydrate blocks from sais_ui fields.
 */
export function hydrateBlocksFromSaisUi(
  saisUi: Record<string, unknown>,
  actions: BlockSyncActions,
): void {
  const now = Date.now();

  // Evidence
  const evidence = saisUi.evidence;
  if (Array.isArray(evidence) && evidence.length > 0) {
    actions.upsertBlock({
      id: "evidence-collection",
      type: "evidence-collection",
      level: "l2",
      data: { items: evidence, count: evidence.length },
      priority: 0.7,
      state: "populated",
      updatedAt: now,
    });
  }

  // Grounded entities
  const entities = saisUi.grounded_entities;
  if (Array.isArray(entities) && entities.length > 0) {
    actions.upsertBlock({
      id: "entity-map",
      type: "entity-map",
      level: "l2",
      data: { entities },
      priority: 0.8,
      state: "populated",
      updatedAt: now,
    });
  }

  // Build plan
  const buildPlan = saisUi.build_plan;
  if (buildPlan && typeof buildPlan === "object") {
    actions.upsertBlock({
      id: "plan-preview",
      type: "plan-preview",
      level: "l3",
      data: buildPlan as Record<string, unknown>,
      priority: 0.5,
      state: "populated",
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Thread summary hydration — always-on L2 block after first tool call
// ---------------------------------------------------------------------------

/** Map tool names to data sources for thread summary. */
const TOOL_SOURCE_MAP: Record<string, string> = {
  postgres_query: "postgres",
  query_postgres_ro: "postgres",
  describe_columns: "postgres",
  profile_columns: "postgres",
  detect_relationships: "postgres",
  detect_temporal_grain: "postgres",
  metabase_query: "metabase",
  build_dashboard: "metabase",
  dbt_query: "dbt",
  trace_lineage: "dbt",
};

/**
 * Derive and upsert a thread-summary block from messages + stream values.
 * Shows after the first tool call; hidden for pure chat.
 */
export function hydrateThreadSummary(
  messages: Message[],
  streamValues: Record<string, unknown> | null,
  actions: BlockSyncActions,
): void {
  // Count tools from AI messages with tool_calls
  const toolCounts = new Map<string, number>();
  const sources = new Set<string>();
  let hasTool = false;

  for (const msg of messages) {
    if (msg.type === "ai" && "tool_calls" in msg) {
      const aiMsg = msg as { tool_calls?: Array<{ name?: string }> };
      if (aiMsg.tool_calls) {
        for (const tc of aiMsg.tool_calls) {
          if (tc.name) {
            hasTool = true;
            toolCounts.set(tc.name, (toolCounts.get(tc.name) ?? 0) + 1);
            const src = TOOL_SOURCE_MAP[tc.name];
            if (src) sources.add(src);
          }
        }
      }
    }
  }

  // Don't show for pure chat (no tool calls)
  if (!hasTool) return;

  // Extract entities from resolved_entities in stream values
  const entities: Array<{ name: string; type: string }> = [];
  if (streamValues) {
    const resolved = streamValues.resolved_entities as Record<string, { name?: string; type?: string }> | undefined;
    if (resolved && typeof resolved === "object") {
      for (const [key, val] of Object.entries(resolved)) {
        if (val && typeof val === "object") {
          entities.push({
            name: val.name ?? key,
            type: val.type ?? "unknown",
          });
        }
      }
    }
  }

  // Build tools used array
  const toolsUsed = Array.from(toolCounts.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  // Count user turns
  const turnCount = messages.filter((m) => m.type === "human").length;

  actions.upsertBlock({
    id: "thread-summary",
    type: "thread-summary",
    level: "l2",
    data: {
      entities,
      toolsUsed,
      sourcesTouched: Array.from(sources),
      turnCount,
    },
    priority: 0.3, // low priority — context, not action
    state: "populated",
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * useBlockSync — Wire SSE stream events to the block store.
 *
 * Call this in the Thread component. It:
 * 1. Listens to SSE values for block_update, tool_result, subagent events
 * 2. Routes them to the Zustand block store via startTransition
 * 3. Handles thread switching and sais_ui hydration
 */
export function useBlockSync(
  streamValues: Record<string, unknown> | null,
  threadId: string | null,
  isStreaming: boolean,
  messages?: Message[],
): void {
  const store = useBlockStore();
  const prevThreadIdRef = useRef<string | null>(null);
  const processedToolMsgIdsRef = useRef<Set<string>>(new Set());

  // Wrap store actions to use startTransition
  const actions: BlockSyncActions = {
    upsertBlock: (block) => startTransition(() => store.upsertBlock(block)),
    removeBlock: (id) => startTransition(() => store.removeBlock(id)),
    applyBlockUpdate: (event) =>
      startTransition(() => store.applyBlockUpdate(event)),
    switchThread: (id) => store.switchThread(id),
  };

  // Thread switch detection
  useEffect(() => {
    if (threadId !== prevThreadIdRef.current) {
      prevThreadIdRef.current = threadId;
      processedToolMsgIdsRef.current = new Set();
      actions.switchThread(threadId);
    }
  }, [threadId]);

  // Process streaming values for block-relevant events.
  // Hydrate during streaming AND when streaming ends (final state).
  useEffect(() => {
    if (!streamValues) return;

    const saisUi = streamValues.sais_ui as Record<string, unknown> | undefined;
    if (saisUi && typeof saisUi === "object") {
      hydrateBlocksFromSaisUi(saisUi, actions);
    }
  }, [streamValues, isStreaming]);

  // V1 fallback: route tool results from messages via TOOL_BLOCK_MAP.
  // Scans messages for ToolMessages whose preceding AIMessage tool_calls
  // match a TOOL_BLOCK_MAP entry. Deduplicates by message ID.
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Build a map of tool_call_id -> tool_name from AI messages
    const toolCallNames = new Map<string, string>();
    for (const msg of messages) {
      if (msg.type === "ai" && "tool_calls" in msg) {
        const aiMsg = msg as { tool_calls?: Array<{ id?: string; name?: string }> };
        if (aiMsg.tool_calls) {
          for (const tc of aiMsg.tool_calls) {
            if (tc.id && tc.name) {
              toolCallNames.set(tc.id, tc.name);
            }
          }
        }
      }
    }

    // Process tool messages
    for (const msg of messages) {
      if (msg.type !== "tool" || !msg.id) continue;
      if (processedToolMsgIdsRef.current.has(msg.id)) continue;

      const toolCallId = "tool_call_id" in msg ? (msg as any).tool_call_id : undefined;
      const toolName = toolCallId
        ? toolCallNames.get(toolCallId)
        : ((msg as any).name ?? undefined);

      if (!toolName) continue;

      const mapping = TOOL_BLOCK_MAP[toolName as keyof typeof TOOL_BLOCK_MAP];
      if (!mapping) continue;

      // Parse content — only route structured JSON results to blocks.
      // Text-only tool results (for LLM consumption) are not block-compatible.
      let resultData: Record<string, unknown> | null = null;
      try {
        if (typeof msg.content === "string" && msg.content.trim()) {
          const parsed = JSON.parse(msg.content);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            resultData = parsed;
          }
        }
      } catch {
        // Not JSON — text result, skip block routing
      }

      processedToolMsgIdsRef.current.add(msg.id);
      if (resultData) {
        routeToolResultEvent(toolName, resultData, actions);
      }
    }

    // Hydrate thread-summary block from messages + stream values
    hydrateThreadSummary(messages, streamValues, actions);
  }, [messages]);
}
