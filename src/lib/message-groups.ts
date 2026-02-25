/**
 * Message grouping and stage derivation for the thought process pane (UAT-4).
 *
 * SAIS uses a LangGraph node-based architecture (not LangChain tool-calling),
 * so every turn produces exactly one AIMessage. Stages are derived from the
 * deterministic graph flow: ground_entities → intent_router → [flow] → respond.
 *
 * Filtering strategy (metadata-driven, no content inspection):
 *
 * Final AI messages are identified by `response_metadata.active_flow`, which
 * is set exclusively by `build_respond_payload()` in the respond node.
 * Intermediate node outputs (from intent_router, evidence_agent, etc.) that
 * surface via `streamSubgraphs` during streaming never carry this marker.
 *
 * During streaming:
 *   - Messages WITH `response_metadata.active_flow` → confirmed final → render
 *   - Messages BEFORE the last human message → historical (always final) → render
 *   - Messages AFTER last human WITHOUT metadata → intermediate streaming → skip
 *
 * When not streaming (loading thread history):
 *   - All messages are from persisted checkpoints → all final → render
 *
 * The flow type comes from:
 * - sais_ui.active_flow (last message, via useSaisUi)
 * - response_metadata.active_flow (historical messages)
 */

import type { Message, AIMessage } from "@langchain/langgraph-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThoughtStage {
  /** Unique ID for this stage */
  id: string;
  /** Human-readable label (e.g. "Querying catalog") */
  label: string;
  /** Optional detail text derived from streaming state (e.g. "Found: sales, orders") */
  detail?: string;
}

export interface MessageGroup {
  /** The message to render */
  message: Message;
  /** Derived thought stages for this message (empty for human messages) */
  stages: ThoughtStage[];
  /** The next human message after this one (for disambiguation selection tracking) */
  nextHumanMessage?: Message;
}

export interface GroupMessagesOptions {
  /**
   * Whether the agent is currently streaming a response.
   * When true, AI messages after the last human message that lack
   * `response_metadata.active_flow` are treated as intermediate
   * subgraph outputs and filtered out.
   */
  isStreaming?: boolean;
  /**
   * Current sais_ui state. When provided, enables dynamic stage
   * derivation from `stage_definitions` declared by the active flow.
   * Applied to the LAST AI message group (current turn) only —
   * historical messages use per-message response_metadata.
   */
  saisUi?: Record<string, unknown> | null;
  /**
   * Message IDs that existed before the current streaming session started.
   * @deprecated No longer tracked after REST message migration (Phase 23.4).
   * Kept for backward compatibility — always pass undefined or empty Set.
   */
  preStreamIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Stage derivation from flow type
// ---------------------------------------------------------------------------

/** Standard stages that always run before any flow. */
const PRE_FLOW_STAGES: ThoughtStage[] = [
  { id: "resolve", label: "Resolving entities" },
  { id: "intent", label: "Understanding intent" },
];

/** The final stage that always runs. */
const RESPOND_STAGE: ThoughtStage = { id: "respond", label: "Composing response" };

// Fallback for threads without stage_definitions -- Phase 23.3 dynamic stages take priority
// Flow-specific stages are now delivered dynamically via sais_ui.stage_definitions
// from the backend flow registry. No hardcoded stage lists needed.

// ---------------------------------------------------------------------------
// Dynamic stage derivation from sais_ui.stage_definitions
// ---------------------------------------------------------------------------

/** A stage definition as declared by the backend flow via sais_ui.stage_definitions */
export interface StageDefinitionFromBackend {
  id: string;
  label: string;
  data_key: string;
}

/**
 * Derive ThoughtStage[] from sais_ui.stage_definitions (dynamic, flow-declared).
 *
 * Each flow declares its own stages via stage_definitions in sais_ui.
 * The current stage value is read from sais_ui[data_key] and used to determine
 * completed/active/pending status (handled by the consumer).
 *
 * Returns null if stage_definitions is not present (fallback to static FLOW_STAGES).
 */
export function deriveStagesFromSaisUi(
  saisUi: Record<string, unknown> | null | undefined,
): ThoughtStage[] | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const stageDefs = saisUi.stage_definitions;
  if (!Array.isArray(stageDefs) || stageDefs.length === 0) return null;

  // Validate shape
  const valid = stageDefs.every(
    (s: unknown) =>
      s &&
      typeof s === "object" &&
      typeof (s as StageDefinitionFromBackend).id === "string" &&
      typeof (s as StageDefinitionFromBackend).label === "string",
  );
  if (!valid) return null;

  const defs = stageDefs as StageDefinitionFromBackend[];

  // Read current stage value from the data_key (all defs share the same data_key typically)
  const currentStageValue = defs[0]?.data_key
    ? (saisUi[defs[0].data_key] as string | undefined)
    : undefined;

  // Find the index of the current stage
  const currentIdx = currentStageValue
    ? defs.findIndex((d) => d.id === currentStageValue)
    : -1;

  return defs.map((def, idx) => {
    // Read subtitle from sais_ui (e.g., rpabv_stage_subtitle).
    // Only show it on the CURRENT active stage — otherwise stale subtitles
    // from a previous stage bleed into subsequent stages (G1' fix).
    let detail: string | undefined;
    if (idx === currentIdx) {
      const subtitleKey = `${def.data_key}_subtitle`;
      const subtitle = saisUi[subtitleKey];
      detail = typeof subtitle === "string" && subtitle.length > 0 ? subtitle : undefined;
    }

    return {
      id: def.id,
      label: def.label,
      detail,
      // Store status info for consumers
      _stageIndex: idx,
      _currentIndex: currentIdx,
    } as ThoughtStage;
  });
}

/**
 * Compute the dynamic stage index from sais_ui for data-driven reveal.
 * Returns the index of the current active stage (0-based), or -1 if unknown.
 */
export function computeDynamicStageReveal(
  saisUi: Record<string, unknown> | null | undefined,
  stages: ThoughtStage[],
): number {
  if (!saisUi || stages.length === 0) return 0;
  const stageDefs = saisUi.stage_definitions;
  if (!Array.isArray(stageDefs) || stageDefs.length === 0) return 0;

  const defs = stageDefs as StageDefinitionFromBackend[];
  const currentStageValue = defs[0]?.data_key
    ? (saisUi[defs[0].data_key] as string | undefined)
    : undefined;

  if (!currentStageValue) return 0;

  // Find the current stage in the full stages array (includes PRE_FLOW + dynamic + RESPOND)
  // Dynamic stages start after PRE_FLOW_STAGES
  const dynamicStartIdx = PRE_FLOW_STAGES.length;
  const currentDynIdx = defs.findIndex((d) => d.id === currentStageValue);
  if (currentDynIdx >= 0) {
    // Reveal up to: all pre-flow + completed dynamic stages + current active
    return dynamicStartIdx + currentDynIdx + 1;
  }

  return 0;
}

/**
 * Derive thought stages for an AI message based on the flow type.
 *
 * Every SAIS response goes through:
 *   ground_entities → intent_router → [flow subgraph] → respond
 *
 * This function maps that architecture to user-visible stages.
 * If saisUi contains stage_definitions (Phase 23.3), uses dynamic stages.
 * Otherwise falls back to static FLOW_STAGES.
 */
export function deriveStagesFromFlow(
  flowType: string | null | undefined,
  saisUi?: Record<string, unknown> | null,
): ThoughtStage[] {
  // Try dynamic stages from sais_ui.stage_definitions first
  const dynamicStages = deriveStagesFromSaisUi(saisUi);
  if (dynamicStages) {
    return [...PRE_FLOW_STAGES, ...dynamicStages, RESPOND_STAGE];
  }

  // Fallback: generic single stage (dynamic stages not yet received from backend)
  return [...PRE_FLOW_STAGES, { id: "flow-processing", label: "Processing" }, RESPOND_STAGE];
}

// ---------------------------------------------------------------------------
// Stage detail derivation from streaming state
// ---------------------------------------------------------------------------

/**
 * Deterministic intent→flow mapping matching backend flow_router.
 * Used during streaming to derive the correct flow stages before
 * flow_router sets active_flow (which arrives too late for fast flows).
 */
const INTENT_TO_FLOW: Record<string, string> = {
  investigate: "investigation",
  ask_question: "investigation",
  ask_metadata: "catalog",
  ask_status: "catalog",
  recommend_next: "catalog",
  general: "catalog",
  build: "build",
  refresh: "ops",
  close_case: "ops",
};

/** Infer flow type from classified intent (available before flow_router runs). */
export function inferFlowFromIntent(intent: string | undefined): string | null {
  if (!intent) return null;
  return INTENT_TO_FLOW[intent] ?? null;
}

/** Human-readable intent labels for display in the thought pane. */
const INTENT_LABELS: Record<string, string> = {
  investigate: "Investigation",
  ask_question: "Data question",
  ask_metadata: "Catalog query",
  ask_status: "Status check",
  recommend_next: "Recommendation",
  general: "General",
  build: "Build request",
  refresh: "Refresh",
  close_case: "Close case",
};

/**
 * Streaming state values used to derive stage details.
 * Mirrors a subset of backend AgentState fields available via stream.values.
 */
export interface StreamingStateValues {
  turn_id?: string;
  resolved_entities?: Record<string, { name?: string; entity_type?: string }>;
  intent?: string;
  intent_confidence?: number;
  active_flow?: string;
  evidence_result?: {
    evidence?: Array<{ type?: string; title?: string }>;
    still_missing?: string[];
    metadata_results?: Array<Record<string, unknown>>;
    catalog_count?: { count?: number; entity_type?: string };
  };
  findings?: {
    root_cause?: { statement?: string; confidence?: number };
  };
  sais_ui?: {
    active_flow?: string;
    rpabv_stage?: string;
    research_progress?: {
      iteration?: number;
      max_iterations?: number;
      status?: string;
      context_found?: { models?: number; sources?: number; evidence?: number };
      verdict?: { sufficient?: boolean; confidence?: number; gaps?: string[] };
    };
    validation_progress?: {
      steps_checked?: number;
      warnings?: number;
      status?: string;
    };
  };
}

/**
 * Derive stage detail strings from the current streaming state.
 * Returns a map of stage ID → detail text.
 *
 * Called during streaming to populate the thought pane with
 * contextual information as each graph node completes.
 */
export function deriveStageDetails(
  values: StreamingStateValues,
): Record<string, string> {
  const details: Record<string, string> = {};

  // Resolve stage: show entity names found
  const entities = values.resolved_entities;
  if (entities && typeof entities === "object") {
    const names = Object.values(entities)
      .map((e) => e?.name)
      .filter(Boolean);
    if (names.length > 0) {
      const display = names.length <= 3
        ? names.join(", ")
        : `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
      details.resolve = `Found: ${display}`;
    }
  }

  // Intent stage: show classified intent + confidence
  if (values.intent) {
    const label = INTENT_LABELS[values.intent] || values.intent;
    const conf = values.intent_confidence;
    if (conf && conf > 0) {
      details.intent = `${label} (${Math.round(conf * 100)}%)`;
    } else {
      details.intent = label;
    }
  }

  // Evidence stage (investigation flow): show evidence count + types
  // Stage ID "collecting" matches backend StageDefinition in investigation_flow.py
  const evidenceResult = values.evidence_result;
  if (evidenceResult?.evidence && evidenceResult.evidence.length > 0) {
    const types = [...new Set(
      evidenceResult.evidence.map((e) => e.type).filter(Boolean),
    )];
    const count = evidenceResult.evidence.length;
    details.collecting = `${count} piece${count !== 1 ? "s" : ""}: ${types.join(", ")}`;
  }

  // Catalog flow: show metadata result count
  // Stage ID "scanning" matches backend StageDefinition in catalog_flow.py
  if (evidenceResult?.catalog_count) {
    const cc = evidenceResult.catalog_count;
    if (cc.count != null && cc.count > 0) {
      const typeLabel = cc.entity_type || "items";
      details.scanning = `${cc.count} ${typeLabel} found`;
    }
  } else if (evidenceResult?.metadata_results && evidenceResult.metadata_results.length > 0) {
    const count = evidenceResult.metadata_results.length;
    details.scanning = `${count} result${count !== 1 ? "s" : ""} found`;
  }

  // Build flow stages — IDs match backend StageDefinitions in build_flow.py:
  // research, plan, approve, build, verify
  const saisUi = values.sais_ui;
  if (saisUi?.research_progress) {
    const rp = saisUi.research_progress;
    if (rp.context_found) {
      const cf = rp.context_found;
      const parts: string[] = [];
      if (cf.models) parts.push(`${cf.models} models`);
      if (cf.sources) parts.push(`${cf.sources} sources`);
      if (cf.evidence) parts.push(`${cf.evidence} evidence`);
      if (parts.length > 0) {
        details.research = `Found ${parts.join(", ")}`;
      }
    }
    if (rp.status === "evaluating" && rp.verdict) {
      const v = rp.verdict;
      const confPct = v.confidence != null ? `${Math.round(v.confidence * 100)}%` : "";
      const iterLabel = rp.iteration != null && rp.max_iterations
        ? `${rp.iteration + 1}/${rp.max_iterations}`
        : "";
      // Eval is part of the research stage
      details.research = [iterLabel, confPct ? `confidence ${confPct}` : ""]
        .filter(Boolean)
        .join(" — ") || "Evaluating";
    }
  }
  if (saisUi?.rpabv_stage === "plan") {
    const level = (values as Record<string, unknown>).rpabv_level;
    if (typeof level === "number" && level > 0) {
      details.plan = `L${level} execution plan`;
    }
  }
  if (saisUi?.validation_progress) {
    const vp = saisUi.validation_progress;
    if (vp.steps_checked != null) {
      const warnLabel = vp.warnings ? ` (${vp.warnings} warnings)` : "";
      details.verify = `Checked ${vp.steps_checked} steps${warnLabel}`;
    }
  }

  // Synthesis stage (investigation flow): show root cause confidence
  // Stage ID "synthesizing" matches backend StageDefinition in investigation_flow.py
  const findings = values.findings;
  if (findings?.root_cause) {
    const conf = findings.root_cause.confidence;
    if (conf && conf > 0) {
      details.synthesizing = `Root cause identified (${Math.round(conf * 100)}%)`;
    } else if (findings.root_cause.statement) {
      details.synthesizing = "Root cause identified";
    }
  }

  return details;
}

/**
 * Compute the minimum number of stages that should be revealed based on
 * actual streaming state data. This makes the progressive reveal data-driven:
 * when the backend populates a field (e.g. intent after intent_router completes),
 * the corresponding stage is immediately shown as completed.
 *
 * Returns the count of stages that should be revealed (1-based, like revealedCount).
 * The last revealed stage is "in progress", previous ones are "completed".
 */
export function computeDataDrivenReveal(
  values: StreamingStateValues,
  stages: ThoughtStage[],
): number {
  // Walk through stages and check if their data is available.
  // A stage's data being present means the corresponding graph node has completed,
  // so we should reveal UP TO the next stage (current completed + next in-progress).
  let lastCompletedIdx = -1;

  for (let i = 0; i < stages.length; i++) {
    const id = stages[i].id;
    if (id === "resolve" && values.resolved_entities !== undefined) {
      lastCompletedIdx = i;
    } else if (id === "intent" && values.intent !== undefined) {
      lastCompletedIdx = i;
    } else if (id === "research" && values.sais_ui?.research_progress !== undefined) {
      if (values.sais_ui.research_progress.status === "evaluating") {
        lastCompletedIdx = i;
      } else {
        return i + 1; // research in progress
      }
    } else if (id === "plan" && (values.sais_ui?.rpabv_stage === "plan" || values.sais_ui?.rpabv_stage === "approve" || values.sais_ui?.rpabv_stage === "build" || values.sais_ui?.rpabv_stage === "verify")) {
      if (values.sais_ui.rpabv_stage !== "plan") {
        lastCompletedIdx = i;
      } else {
        return i + 1; // plan in progress
      }
    } else if (id === "approve" && (values.sais_ui?.rpabv_stage === "approve" || values.sais_ui?.rpabv_stage === "build" || values.sais_ui?.rpabv_stage === "verify")) {
      if (values.sais_ui.rpabv_stage !== "approve") {
        lastCompletedIdx = i;
      } else {
        return i + 1; // approve in progress
      }
    } else if (id === "build" && (values.sais_ui?.rpabv_stage === "build" || values.sais_ui?.rpabv_stage === "verify")) {
      if (values.sais_ui.rpabv_stage === "verify") {
        lastCompletedIdx = i;
      } else {
        return i + 1; // build in progress
      }
    } else if (id === "verify" && values.sais_ui?.rpabv_stage === "verify") {
      lastCompletedIdx = i;
    } else if (values.active_flow !== undefined && !["resolve", "intent", "respond"].includes(id)) {
      if (values.evidence_result !== undefined || values.findings !== undefined) {
        lastCompletedIdx = i;
      } else {
        return i + 1;
      }
    }
  }

  if (lastCompletedIdx >= 0) {
    // Reveal completed stages + next one as in-progress
    return Math.min(lastCompletedIdx + 2, stages.length);
  }

  return 0; // No data yet — let timer handle initial reveal
}

/**
 * Apply detail strings to a stages array, returning new stage objects
 * with `detail` populated where available.
 */
export function applyStageDetails(
  stages: ThoughtStage[],
  details: Record<string, string>,
): ThoughtStage[] {
  if (Object.keys(details).length === 0) return stages;
  return stages.map((stage) => {
    const detail = details[stage.id];
    return detail ? { ...stage, detail } : stage;
  });
}

/**
 * Extract the active flow from a message's response_metadata.
 * Used for historical messages where sais_ui is not available.
 */
export function extractFlowFromResponseMeta(
  message: Message | undefined,
): string | null {
  if (!message || message.type !== "ai") return null;
  const meta = "response_metadata" in message
    ? (message as AIMessage).response_metadata
    : undefined;
  if (!meta || typeof meta !== "object") return null;
  const flow = (meta as Record<string, unknown>).active_flow;
  return typeof flow === "string" && flow.length > 0 ? flow : null;
}

// ---------------------------------------------------------------------------
// Message grouping (for nextHumanMessage tracking)
// ---------------------------------------------------------------------------

function getContentString(content: Message["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === "text")
      .map((c: Record<string, unknown>) => (c as { text: string }).text || "")
      .join("");
  }
  return "";
}

/**
 * Build MessageGroups from a flat message list.
 *
 * With REST-sourced messages (Phase 23.4), all messages returned by the
 * LangGraph thread state API are persisted and final. No intermediate
 * subgraph outputs appear in REST responses.
 *
 * Simplified filtering:
 * - Tool result messages: hidden (rendered inline by tool-calls component)
 * - Tool-only AI messages (no text content, no blocks): hidden
 * - All other AI messages: rendered with stages derived from metadata
 * - Human messages: always rendered
 */
export function groupMessages(
  messages: Message[],
  options?: GroupMessagesOptions,
): MessageGroup[] {
  const saisUi = options?.saisUi ?? null;
  const groups: MessageGroup[] = [];

  // Find the index of the last human message — used to determine
  // which AI message gets saisUi for dynamic stage derivation.
  let lastHumanIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "human") {
      lastHumanIdx = i;
      break;
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.type === "human") {
      groups.push({ message: msg, stages: [] });
      continue;
    }

    if (msg.type === "tool") {
      // Tool result messages are hidden
      continue;
    }

    if (msg.type === "ai") {
      const content = getContentString(msg.content ?? []);
      // Check for blocks in response_metadata (Phase 23.4 blocks model)
      const meta = "response_metadata" in msg
        ? (msg as AIMessage).response_metadata
        : undefined;
      const hasBlocks = meta && typeof meta === "object"
        && Array.isArray((meta as Record<string, unknown>).blocks)
        && ((meta as Record<string, unknown>).blocks as unknown[]).length > 0;

      if (content.trim().length === 0 && !hasBlocks) {
        // Tool-only AI messages with no text content and no blocks — skip
        continue;
      }

      // Derive flow type from response_metadata
      const flowType = extractFlowFromResponseMeta(msg);

      // Use saisUi for dynamic stages on messages after the last human
      // (current turn). Historical messages rely on their own response_metadata.
      const isCurrentTurn = i >= lastHumanIdx;
      const uiForStages = isCurrentTurn ? saisUi : null;

      // All REST-sourced messages are final — render with stages
      const stages = deriveStagesFromFlow(flowType, uiForStages);
      groups.push({ message: msg, stages });
    }
  }

  // Attach nextHumanMessage to each AI group (for disambiguation selection tracking)
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].message.type !== "human") {
      for (let j = i + 1; j < groups.length; j++) {
        if (groups[j].message.type === "human") {
          groups[i].nextHumanMessage = groups[j].message;
          break;
        }
      }
    }
  }

  return groups;
}
