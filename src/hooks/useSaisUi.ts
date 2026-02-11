/**
 * useSaisUi - Frontend adapter hook for sais_ui state.
 *
 * This is the ONLY file allowed to access .values.sais_ui directly.
 * All other components must use this hook or the exported accessor functions.
 *
 * Purpose: Isolate components from raw sais_ui structure, provide normalized booleans/enums,
 * and enable type-safe access to flow-specific state.
 */

import { useMemo } from "react";
import { useStreamContext } from "@/providers/Stream";
import { parseSaisUi } from "@/lib/schemas/sais-ui";
import type { SaisUi } from "@/lib/schemas/sais-ui";

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Parsed blocker from sais_ui */
export interface SaisUiBlocker {
  type: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  hint: string;
  what_i_tried?: string[];
  recovery_actions?: string[];
  metadata?: Record<string, unknown>;
}

/** Permission grant from sais_ui.permissions.grants */
export interface SaisUiPermissionGrant {
  capability: string;
  scope: string;
  granted_at: string;
  expires_at: string | null;
  pending_action_id: string | null;
}

/** useSaisUi hook return type with normalized derived state */
export interface UseSaisUiResult {
  /** Raw parsed sais_ui (escape hatch for type-specific access) */
  raw: SaisUi | null;

  // Flow type
  /** Currently active flow type (catalog | investigation | remediation | ops | build) */
  flowType: string | null;
  /** Case status string from backend */
  caseStatus: string | null;

  // Blockers
  /** True if blockers array is non-empty */
  hasBlockers: boolean;
  /** Array of blocker objects */
  blockers: SaisUiBlocker[];

  // Investigation flow
  /** True if active_flow === "investigation" */
  isInvestigating: boolean;
  /** True if evidence array is non-empty */
  hasEvidence: boolean;
  /** Evidence array from investigation flow */
  evidence: Array<Record<string, unknown>>;
  /** Findings dict from investigation flow */
  findings: Record<string, unknown> | null;

  // Catalog flow
  /** True if active_flow === "catalog" */
  isCatalog: boolean;
  /** Metadata results from catalog flow */
  metadataResults: Array<Record<string, unknown>>;
  /** Disambiguation data for ambiguous entity queries */
  disambiguation: Record<string, unknown> | null;

  // Remediation flow
  /** Remediation proposals array */
  remediationProposals: Array<Record<string, unknown>>;

  // Build flow
  /** True if active_flow === "build" */
  isBuild: boolean;
  /** True if build_plan object exists */
  hasBuildPlan: boolean;
  /** Build plan status (proposed | approved | rejected | executing | completed | failed) */
  buildPlanStatus: string | null;
  /** Build verification result dict */
  buildVerificationResult: Record<string, unknown> | null;

  // Cross-flow state
  /** Handoff proposal (flow transition request) */
  handoff: Record<string, unknown> | null;
  /** Resolution steps for debugging UI */
  resolutionSteps: Record<string, unknown> | null;
  /** Confidence data (level, reason) */
  confidence: Record<string, unknown> | null;
  /** Multi-intent decomposition payload */
  multiIntent: Record<string, unknown> | null;

  // Permissions
  /** Permissions object from sais_ui */
  permissions: Record<string, unknown> | null;
  /** True if permissions.grants array is non-empty */
  hasPermissionGrants: boolean;
  /** Array of permission grants */
  permissionGrants: SaisUiPermissionGrant[];
}

// ---------------------------------------------------------------------------
// Pure Accessor Functions (non-hook, for use outside React components)
// ---------------------------------------------------------------------------

/**
 * Extract flow_type from raw sais_ui.
 * Corresponds to extractActiveFlow from ai.tsx.
 */
export function extractFlowType(saisUi: unknown): string | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const flow = obj.active_flow;
  return typeof flow === "string" && flow.length > 0 ? flow : null;
}

/**
 * Extract blockers array from raw sais_ui.
 */
export function extractBlockers(saisUi: unknown): SaisUiBlocker[] {
  if (!saisUi || typeof saisUi !== "object") return [];
  const obj = saisUi as Record<string, unknown>;
  const blockers = obj.blockers;
  if (!Array.isArray(blockers) || blockers.length === 0) return [];
  // Validate each blocker has required fields
  const valid = blockers.every(
    (b: unknown) =>
      b &&
      typeof b === "object" &&
      typeof (b as Record<string, unknown>).type === "string" &&
      typeof (b as Record<string, unknown>).severity === "string" &&
      typeof (b as Record<string, unknown>).message === "string"
  );
  return valid ? (blockers as SaisUiBlocker[]) : [];
}

/**
 * Extract evidence array from investigation flow.
 */
export function extractEvidence(saisUi: unknown): Array<Record<string, unknown>> {
  if (!saisUi || typeof saisUi !== "object") return [];
  const obj = saisUi as Record<string, unknown>;
  const evidence = obj.evidence;
  return Array.isArray(evidence) ? evidence : [];
}

/**
 * Extract confidence data from sais_ui.
 */
export function extractConfidence(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const confidence = obj.confidence;
  if (!confidence || typeof confidence !== "object") return null;
  return confidence as Record<string, unknown>;
}

/**
 * Extract build_plan from build flow.
 */
export function extractBuildPlan(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const buildPlan = obj.build_plan;
  if (!buildPlan || typeof buildPlan !== "object") return null;
  return buildPlan as Record<string, unknown>;
}

/**
 * Extract build_plan_status from build flow.
 */
export function extractBuildPlanStatus(saisUi: unknown): string | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const status = obj.build_plan_status;
  return typeof status === "string" ? status : null;
}

/**
 * Extract build_verification_result from build flow.
 */
export function extractBuildVerification(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const verificationResult = obj.build_verification_result;
  if (!verificationResult || typeof verificationResult !== "object") return null;
  return verificationResult as Record<string, unknown>;
}

/**
 * Extract handoff proposal from sais_ui.
 */
export function extractHandoffProposal(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const handoff = obj.handoff;
  if (!handoff || typeof handoff !== "object") return null;
  return handoff as Record<string, unknown>;
}

/**
 * Extract remediation_proposals array from remediation flow.
 */
export function extractRemediationProposals(saisUi: unknown): Array<Record<string, unknown>> {
  if (!saisUi || typeof saisUi !== "object") return [];
  const obj = saisUi as Record<string, unknown>;
  const proposals = obj.remediation_proposals;
  return Array.isArray(proposals) ? proposals : [];
}

/**
 * Extract multi_intent payload from sais_ui.
 */
export function extractMultiIntent(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const multiIntent = obj.multi_intent;
  if (!multiIntent || typeof multiIntent !== "object") return null;
  return multiIntent as Record<string, unknown>;
}

/**
 * Extract metadata_results from sais_ui.
 */
export function extractMetadataResults(saisUi: unknown): Array<Record<string, unknown>> {
  if (!saisUi || typeof saisUi !== "object") return [];
  const obj = saisUi as Record<string, unknown>;
  const results = obj.metadata_results;
  return Array.isArray(results) ? results : [];
}

/**
 * Extract disambiguation from sais_ui.
 */
export function extractDisambiguation(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const disambiguation = obj.disambiguation;
  if (!disambiguation || typeof disambiguation !== "object") return null;
  return disambiguation as Record<string, unknown>;
}

/**
 * Extract resolution_steps from sais_ui.
 */
export function extractResolutionSteps(saisUi: unknown): Record<string, unknown> | null {
  if (!saisUi || typeof saisUi !== "object") return null;
  const obj = saisUi as Record<string, unknown>;
  const steps = obj.resolution_steps;
  if (!steps || typeof steps !== "object") return null;
  return steps as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

/**
 * useSaisUi - React hook that reads sais_ui from stream context and returns
 * normalized, derived state.
 *
 * This hook should be used by ALL components that need to access sais_ui data.
 * It provides:
 * - Zod-validated parsing with fallback
 * - Normalized booleans (hasBlockers, isInvestigating, etc.)
 * - Derived enums (flowType, caseStatus)
 * - Memoized recomputation (only when sais_ui reference changes)
 */
export function useSaisUi(): UseSaisUiResult {
  const { values } = useStreamContext();
  const rawSaisUi = values.sais_ui;

  return useMemo(() => {
    // Parse with Zod schema (warn-and-fallback)
    const parsed = parseSaisUi(rawSaisUi);

    // Extract all derived state
    const flowType = extractFlowType(parsed);
    const caseStatus = parsed?.case_status ?? null;
    const blockers = extractBlockers(parsed);
    const evidence = extractEvidence(parsed);
    const findings = (parsed && typeof parsed === "object" && "findings" in parsed && parsed.findings && typeof parsed.findings === "object")
      ? (parsed.findings as Record<string, unknown>)
      : null;

    const metadataResults = (parsed && typeof parsed === "object" && "metadata_results" in parsed && Array.isArray(parsed.metadata_results))
      ? (parsed.metadata_results as Array<Record<string, unknown>>)
      : [];

    const disambiguation = (parsed && typeof parsed === "object" && "disambiguation" in parsed && parsed.disambiguation && typeof parsed.disambiguation === "object")
      ? (parsed.disambiguation as Record<string, unknown>)
      : null;

    const remediationProposals = extractRemediationProposals(parsed);
    const buildPlan = extractBuildPlan(parsed);
    const buildPlanStatus = extractBuildPlanStatus(parsed);
    const buildVerificationResult = extractBuildVerification(parsed);
    const handoff = extractHandoffProposal(parsed);
    const confidence = extractConfidence(parsed);

    const multiIntent = (parsed && typeof parsed === "object" && "multi_intent" in parsed && parsed.multi_intent && typeof parsed.multi_intent === "object")
      ? (parsed.multi_intent as Record<string, unknown>)
      : null;

    const resolutionSteps = (parsed && typeof parsed === "object" && "resolution_steps" in parsed && parsed.resolution_steps && typeof parsed.resolution_steps === "object")
      ? (parsed.resolution_steps as Record<string, unknown>)
      : null;

    const permissions = (parsed && typeof parsed === "object" && "permissions" in parsed && parsed.permissions && typeof parsed.permissions === "object")
      ? (parsed.permissions as Record<string, unknown>)
      : null;

    const permissionGrants: SaisUiPermissionGrant[] =
      permissions && Array.isArray((permissions as { grants?: unknown }).grants)
        ? ((permissions as { grants: SaisUiPermissionGrant[] }).grants)
        : [];

    return {
      raw: parsed,
      flowType,
      caseStatus,
      hasBlockers: blockers.length > 0,
      blockers,
      isInvestigating: flowType === "investigation",
      hasEvidence: evidence.length > 0,
      evidence,
      findings,
      isCatalog: flowType === "catalog",
      metadataResults,
      disambiguation,
      remediationProposals,
      isBuild: flowType === "build",
      hasBuildPlan: buildPlan !== null,
      buildPlanStatus,
      buildVerificationResult,
      handoff,
      resolutionSteps,
      confidence,
      multiIntent,
      permissions,
      hasPermissionGrants: permissionGrants.length > 0,
      permissionGrants,
    };
  }, [rawSaisUi]); // Recompute only when sais_ui reference changes
}
