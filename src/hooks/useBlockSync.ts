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
import type { ActivityState, ToolExecution } from "@/components/thread/chat-activity-indicator";

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
// React hook
// ---------------------------------------------------------------------------

/**
 * useBlockSync — Wire SSE stream events to the block store.
 *
 * Call this in the Thread component. It:
 * 1. Listens to SSE values for block_update, tool_result, subagent events
 * 2. Routes them to the Zustand block store via startTransition
 * 3. Manages ActivityState for ChatActivityIndicator
 * 4. Handles thread switching and sais_ui hydration
 */
export function useBlockSync(
  streamValues: Record<string, unknown> | null,
  threadId: string | null,
  isStreaming: boolean,
): ActivityState {
  const store = useBlockStore();
  const prevThreadIdRef = useRef<string | null>(null);
  const activityRef = useRef<ActivityState>({
    subagent: null,
    iteration: null,
    maxIterations: null,
    currentTool: null,
    toolHistory: [],
  });

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
      actions.switchThread(threadId);
      // Reset activity state
      activityRef.current = {
        subagent: null,
        iteration: null,
        maxIterations: null,
        currentTool: null,
        toolHistory: [],
      };
    }
  }, [threadId]);

  // Process streaming values for block-relevant events
  useEffect(() => {
    if (!streamValues || !isStreaming) return;

    // sais_ui hydration (backward compat)
    const saisUi = streamValues.sais_ui as Record<string, unknown> | undefined;
    if (saisUi && typeof saisUi === "object") {
      hydrateBlocksFromSaisUi(saisUi, actions);
    }
  }, [streamValues, isStreaming]);

  return activityRef.current;
}
