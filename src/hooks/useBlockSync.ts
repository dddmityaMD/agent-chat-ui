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
import type { PanelBlock, BlockUpdateEvent, AgentStatusData, AgentStatusEntry } from "@/lib/panel-blocks/types";
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
  existingBlocks?: Record<string, { data?: unknown }>,
): void {
  const mapping =
    TOOL_BLOCK_MAP[toolName as keyof typeof TOOL_BLOCK_MAP];
  if (!mapping) return;

  // If block already exists, merge data instead of replacing (Gap 15 fix).
  // Multiple tools can target the same block (e.g. profile_columns +
  // detect_temporal_grain both → data-profile). Replacing would lose
  // earlier tool data; merging preserves it.
  const existing = existingBlocks?.[mapping.blockId];
  if (existing?.data && typeof existing.data === "object") {
    actions.upsertBlock({
      id: mapping.blockId,
      type: mapping.blockId,
      level: mapping.level,
      data: { ...(existing.data as Record<string, unknown>), ...resultData },
      priority: 0.5,
      state: "populated",
      updatedAt: Date.now(),
    });
  } else {
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
  existingBlocks?: Record<string, { data?: unknown }>,
): void {
  const now = Date.now();

  // D-18 primary path: block_updates (list) from backend tool_node
  const blockUpdates = saisUi.block_updates;
  if (Array.isArray(blockUpdates)) {
    for (const bu of blockUpdates) {
      if (bu && typeof bu === "object") {
        const entry = bu as Record<string, unknown>;
        const toolName = entry.tool_name as string | undefined;
        const data = entry.data as Record<string, unknown> | undefined;
        if (toolName && data) {
          routeToolResultEvent(toolName, data, actions, existingBlocks);
        }
      }
    }
  }

  // Legacy: single block_update (backward compat)
  const blockUpdate = saisUi.block_update;
  if (blockUpdate && typeof blockUpdate === "object" && !Array.isArray(blockUpdates)) {
    const bu = blockUpdate as Record<string, unknown>;
    const toolName = bu.tool_name as string | undefined;
    const data = bu.data as Record<string, unknown> | undefined;
    if (toolName && data) {
      routeToolResultEvent(toolName, data, actions, existingBlocks);
    }
  }

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

  // Subagent artifacts (Phase 63 Gap 13)
  const subagentArtifacts = saisUi.subagent_artifacts;
  if (Array.isArray(subagentArtifacts) && subagentArtifacts.length > 0) {
    // Backend emits list[str] (paths). Enrich to ArtifactListData shape.
    const artifacts = subagentArtifacts.map((item: unknown) => {
      if (typeof item === "string") {
        const ext = item.split(".").pop()?.toLowerCase() ?? "";
        const langMap: Record<string, string> = {
          md: "markdown", sql: "sql", py: "python", yaml: "yaml",
          yml: "yaml", json: "json", ts: "typescript", js: "javascript",
        };
        return {
          path: item,
          operation: "new",
          language: langMap[ext],
        };
      }
      // Already enriched dict from backend
      return item;
    });
    actions.upsertBlock({
      id: "artifact-list",
      type: "artifact-list",
      level: "l3",
      data: { artifacts },
      priority: 0.7,
      state: "populated",
      updatedAt: now,
    });
  }

  // Agent status — track subagent executions chronologically
  const activeSubagent = saisUi.active_subagent;
  if (activeSubagent !== undefined) {
    const existingBlock = existingBlocks?.["agent-status"];
    const existingData = existingBlock?.data as AgentStatusData | undefined;
    const prevEntries: AgentStatusEntry[] = existingData?.entries ?? [];

    if (typeof activeSubagent === "string" && activeSubagent) {
      // New subagent starting — append if not already tracked
      const alreadyExists = prevEntries.some(
        (e) => e.subagent_id === activeSubagent,
      );
      if (!alreadyExists) {
        // Mark any existing "active" entry as "complete", append new one
        const updated = prevEntries.map((e) =>
          e.status === "active" ? { ...e, status: "complete" as const } : e,
        );
        updated.push({ subagent_id: activeSubagent, status: "active" });
        actions.upsertBlock({
          id: "agent-status",
          type: "agent-status",
          level: "l1",
          data: { entries: updated },
          priority: 1.0,
          state: "loading",
          updatedAt: now,
        });
      }
    } else if (activeSubagent === null) {
      // Subagent finished — mark all active as complete
      if (prevEntries.length > 0 && prevEntries.some((e) => e.status === "active")) {
        const completed = prevEntries.map((e) =>
          e.status === "active" ? { ...e, status: "complete" as const } : e,
        );
        actions.upsertBlock({
          id: "agent-status",
          type: "agent-status",
          level: "l1",
          data: { entries: completed },
          priority: 1.0,
          state: "complete",
          updatedAt: now,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Thread summary hydration — always-on L2 block after first tool call
// ---------------------------------------------------------------------------

// TOOL_SOURCE_MAP deleted (Phase 62-08, Rule 3.6).
// Thread summary now reads data_system from response_metadata set by backend.

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
          }
        }
      }
    }
    // Read data_system from backend-provided response_metadata (Rule 3.6)
    if (msg.type === "tool") {
      const meta = (msg as any).response_metadata as
        | Record<string, unknown>
        | undefined;
      const dataSystem = meta?.data_system;
      if (typeof dataSystem === "string" && dataSystem) {
        sources.add(dataSystem);
      }
    }
  }

  // Don't show for pure chat (no tool calls)
  if (!hasTool) return;

  // Extract entities from resolved_entities in stream values
  const entities: Array<{ name: string; type: string; canonical_key?: string }> = [];
  if (streamValues) {
    const resolved = streamValues.resolved_entities as Record<string, Record<string, unknown>> | undefined;
    if (resolved && typeof resolved === "object") {
      for (const [key, val] of Object.entries(resolved)) {
        if (val && typeof val === "object") {
          entities.push({
            name: (val.name as string) ?? key,
            type: (val.entity_type as string) ?? (val.type as string) ?? "unknown",
            canonical_key: (val.canonical_key as string) ?? undefined,
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
      hydrateBlocksFromSaisUi(saisUi, actions, store.blocks);
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

      // Try structured_data from response_metadata first (set by StructuredToolResult),
      // then fall back to JSON.parse on content for legacy tools.
      let resultData: Record<string, unknown> | null = null;
      const meta = (msg as any).response_metadata as Record<string, unknown> | undefined;
      const structured = meta?.structured_data;
      if (structured && typeof structured === "object" && !Array.isArray(structured)) {
        resultData = structured as Record<string, unknown>;
      } else {
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
      }

      processedToolMsgIdsRef.current.add(msg.id);
      if (resultData) {
        routeToolResultEvent(toolName, resultData, actions, store.blocks);
      }
    }

    // Hydrate thread-summary block from messages + stream values
    hydrateThreadSummary(messages, streamValues, actions);
  }, [messages]);
}
