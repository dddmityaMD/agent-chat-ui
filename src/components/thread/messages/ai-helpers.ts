/**
 * ai-helpers.ts — Pure utility functions, types, and constants extracted from ai.tsx.
 * No JSX — only type guards, data extractors, and display mappings.
 */

import { parsePartialJson } from "@langchain/core/output_parsers";
import { AIMessage } from "@langchain/langgraph-sdk";
import { MessageContentComplex } from "@langchain/core/messages";
import {
  extractHandoffProposal,
  extractRemediationProposals,
  extractBlockers,
  extractConfidence,
  extractMultiIntent,
  extractBuildPlan,
  extractBuildPlanStatus,
  extractBuildVerification,
} from "@/hooks/useSaisUi";
import type { Blocker, MultiIntentPayload, BuildPlan, BuildPlanStatus, VerificationResult } from "@/lib/types";
import type { RemediationProposalData } from "@/components/remediation/DiffCard";
import { EntityType } from "@/components/query";

// ---- Types ----

/** Interrupt decision record stored in response_metadata */
export interface InterruptDecisionRecord {
  type: string;
  message: string;
  decision: "approved" | "rejected";
  feedback?: string | null;
  artifacts?: any[];
  rpabv_level?: number;
  rpabv_progress?: any;
  rpabv_status?: string;
  plan?: any;
  intent?: string;
  entities?: string[];
  step_index?: number;
  total_steps?: number;
}

/** A single metadata section (one entity type) */
export interface MetadataSection {
  entity_type: EntityType;
  items: Array<Record<string, unknown>>;
  total: number;
}

/** metadata_results from sais_ui payload — list (new), flat (legacy single type), or sectioned (legacy mixed) */
export type MetadataResults = MetadataSection[] | MetadataSection | { sections: MetadataSection[] };

/** Handoff proposal from sais_ui payload */
export interface HandoffProposal {
  target_flow: string;
  reason: string;
  confirmed: boolean;
}

// ---- Constants ----

/** Flow display names for handoff UI */
export const FLOW_DISPLAY_NAMES: Record<string, string> = {
  catalog: "Catalog",
  investigation: "Investigation",
  remediation: "Remediation",
  ops: "Operations",
};

/** Display labels for entity type section headers */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  table: "Tables",
  column: "Columns",
  report: "Reports",
  dashboard: "Dashboards",
  dbt_model: "dbt Models",
  git_commit: "Git Commits",
  mixed: "Other",
};

// ---- Type guards ----

/** Check if a single section is valid */
export function isValidSection(s: unknown): s is MetadataSection {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return typeof obj.entity_type === "string" && Array.isArray(obj.items) && typeof obj.total === "number";
}

/** Type guard for sais_ui payload — accepts list (new), flat (legacy single type), or sectioned (legacy mixed) */
export function hasMetadataResults(
  saisUi: unknown,
): saisUi is { metadata_results: MetadataResults } {
  if (!saisUi || typeof saisUi !== "object") return false;
  const obj = saisUi as Record<string, unknown>;
  const mr = obj.metadata_results;
  if (!mr) return false;
  // New list format: MetadataSection[]
  if (Array.isArray(mr)) return mr.some(isValidSection);
  if (typeof mr !== "object") return false;
  const mrObj = mr as Record<string, unknown>;
  // Legacy sectioned format: { sections: [...] }
  if (Array.isArray(mrObj.sections)) return mrObj.sections.some(isValidSection);
  // Legacy flat format: { entity_type, items, total }
  return isValidSection(mrObj);
}

/** Normalize metadata_results into an array of sections */
export function toSections(mr: MetadataResults): MetadataSection[] {
  // New list format: already an array of sections
  if (Array.isArray(mr)) return mr.filter(isValidSection);
  // Legacy sectioned format: { sections: [...] }
  if ("sections" in mr && Array.isArray(mr.sections)) return mr.sections.filter(isValidSection);
  // Legacy flat format: single MetadataSection
  if (isValidSection(mr)) return [mr];
  return [];
}

// ---- Extractor / adapter functions ----

/** Extract an interrupt decision record from response_metadata, if present */
export function getInterruptDecision(meta: Record<string, unknown> | undefined): InterruptDecisionRecord | null {
  if (!meta || typeof meta !== "object") return null;
  const decision = meta.interrupt_decision;
  if (!decision || typeof decision !== "object") return null;
  const d = decision as Record<string, unknown>;
  if (typeof d.type !== "string" || typeof d.message !== "string" || typeof d.decision !== "string") return null;
  if (d.decision !== "approved" && d.decision !== "rejected") return null;
  return d as unknown as InterruptDecisionRecord;
}

/** Wrapper that adapts centralized handoff extractor to local type contract */
export function getHandoffProposal(saisUi: unknown): HandoffProposal | null {
  const handoff = extractHandoffProposal(saisUi);
  if (!handoff || typeof handoff !== "object") return null;
  const h = handoff as Record<string, unknown>;
  if (typeof h.target_flow !== "string") return null;
  return {
    target_flow: h.target_flow,
    reason: typeof h.reason === "string" ? h.reason : "",
    confirmed: h.confirmed === true,
  };
}

export function getRemediationProposals(saisUi: unknown): RemediationProposalData[] | null {
  const proposals = extractRemediationProposals(saisUi);
  if (proposals.length === 0) return null;
  const valid = proposals.every(
    (p: unknown) =>
      p &&
      typeof p === "object" &&
      typeof (p as Record<string, unknown>).fix_id === "string" &&
      typeof (p as Record<string, unknown>).title === "string",
  );
  return valid ? (proposals as unknown as RemediationProposalData[]) : null;
}

export function getBlockers(saisUi: unknown): Blocker[] | null {
  const blockers = extractBlockers(saisUi);
  if (blockers.length === 0) return null;
  return blockers as Blocker[];
}

export function getConfidenceData(saisUi: unknown): { level: "high" | "medium" | "low"; reason?: string } | null {
  const confidence = extractConfidence(saisUi);
  if (!confidence) return null;
  const c = confidence as Record<string, unknown>;
  if (typeof c.level !== "string") return null;
  const level = (c.level as string).toLowerCase();
  if (level !== "high" && level !== "medium" && level !== "low") return null;
  return {
    level: level as "high" | "medium" | "low",
    reason: typeof c.reason === "string" ? c.reason : undefined,
  };
}

export function getMultiIntentPayload(saisUi: unknown): MultiIntentPayload | null {
  const mi = extractMultiIntent(saisUi);
  if (!mi) return null;
  const payload = mi as Record<string, unknown>;
  if (!Array.isArray(payload.intents) || !Array.isArray(payload.results)) return null;
  if (payload.intents.length < 2) return null;
  return {
    intents: payload.intents as MultiIntentPayload["intents"],
    results: payload.results as MultiIntentPayload["results"],
    was_parallel: payload.was_parallel === true,
    merged_output: (payload.merged_output as Record<string, unknown>) || {},
  };
}

export function getBuildPlan(saisUi: unknown): BuildPlan | null {
  const buildPlan = extractBuildPlan(saisUi);
  if (!buildPlan) return null;
  const plan = buildPlan as Record<string, unknown>;
  if (
    typeof plan.plan_id !== "string" ||
    typeof plan.title !== "string" ||
    !Array.isArray(plan.steps) ||
    typeof plan.context_summary !== "string" ||
    typeof plan.estimated_impact !== "string" ||
    typeof plan.risk_level !== "string"
  )
    return null;
  return plan as unknown as BuildPlan;
}

export function getBuildPlanStatus(saisUi: unknown): BuildPlanStatus | null {
  const status = extractBuildPlanStatus(saisUi);
  if (!status) return null;
  const validStatuses: BuildPlanStatus[] = ["proposed", "approved", "rejected", "executing", "completed", "failed"];
  return validStatuses.includes(status as BuildPlanStatus) ? (status as BuildPlanStatus) : null;
}

export function getBuildVerificationResult(saisUi: unknown): VerificationResult | null {
  const verificationResult = extractBuildVerification(saisUi);
  if (!verificationResult) return null;
  const result = verificationResult as Record<string, unknown>;
  if (
    typeof result.status !== "string" ||
    typeof result.comparison_summary !== "string" ||
    typeof result.verification_method !== "string"
  )
    return null;
  return result as unknown as VerificationResult;
}

/** Parse Anthropic-style streamed tool calls from complex message content */
export function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}
