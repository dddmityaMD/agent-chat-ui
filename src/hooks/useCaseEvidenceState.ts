"use client";

import { useState, useCallback, useMemo } from "react";

/**
 * Evidence types that can be explicitly requested
 */
export type EvidenceType = "sql" | "git" | "dbt" | "metabase" | "api";

/**
 * Map of evidence types to their display labels
 */
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  sql: "SQL evidence",
  git: "Git history",
  dbt: "dbt artifacts",
  metabase: "Metabase API",
  api: "API response",
};

/**
 * Map of evidence type IDs to actual evidence type strings
 */
export const EVIDENCE_TYPE_MAP: Record<EvidenceType, string> = {
  sql: "SQL_QUERY_RESULT",
  git: "GIT_DIFF",
  dbt: "DBT_ARTIFACT",
  metabase: "API_RESPONSE",
  api: "API_RESPONSE",
};

/**
 * Friendly warning messages for missing evidence (not alarming)
 */
export const EVIDENCE_MISSING_MESSAGES: Record<EvidenceType, string> = {
  sql: "No SQL results found for this query",
  git: "No git history found for this query",
  dbt: "No dbt artifacts found for this query",
  metabase: "No Metabase data found for this query",
  api: "No API response found for this query",
};

/**
 * Return type for useCaseEvidenceState
 */
export interface UseCaseEvidenceStateReturn {
  /** Set of evidence types the user has explicitly requested */
  requestedTypes: Set<EvidenceType>;
  /** Mark an evidence type as explicitly requested */
  requestEvidenceType: (type: EvidenceType) => void;
  /** Mark multiple evidence types as requested */
  requestEvidenceTypes: (types: EvidenceType[]) => void;
  /** Check if an evidence type has been explicitly requested */
  hasRequestedType: (type: EvidenceType) => boolean;
  /**
   * Determine if a missing warning should be shown for a type.
   * Returns true only if:
   * 1. User explicitly requested that type
   * 2. AND the evidence is missing
   */
  shouldShowMissingWarning: (type: EvidenceType, evidenceExists: boolean) => boolean;
  /** Get a friendly message for missing evidence (if should be shown) */
  getMissingMessage: (type: EvidenceType) => string | null;
  /** Reset all requested types (e.g., when changing cases) */
  resetRequestedTypes: () => void;
  /** Infer evidence types from user intent/query */
  inferTypesFromIntent: (intent: string, query?: string) => void;
}

/**
 * Maps intent types to evidence types that would be requested
 */
function getEvidenceTypesForIntent(intent: string): EvidenceType[] {
  const mapping: Record<string, EvidenceType[]> = {
    investigate: ["sql", "git", "dbt", "metabase"],
    ask_question: ["sql", "dbt"],
    ask_metadata: ["dbt", "metabase"],
    ask_status: [],
    recommend_next: [],
    close_case: [],
  };
  return mapping[intent] || [];
}

/**
 * Infer evidence types from query keywords
 */
function inferTypesFromQuery(query: string): EvidenceType[] {
  const types: EvidenceType[] = [];
  const lowerQuery = query.toLowerCase();

  // SQL-related keywords
  if (
    lowerQuery.includes("query") ||
    lowerQuery.includes("sql") ||
    lowerQuery.includes("data") ||
    lowerQuery.includes("rows") ||
    lowerQuery.includes("table")
  ) {
    types.push("sql");
  }

  // Git-related keywords
  if (
    lowerQuery.includes("git") ||
    lowerQuery.includes("commit") ||
    lowerQuery.includes("change") ||
    lowerQuery.includes("history") ||
    lowerQuery.includes("diff")
  ) {
    types.push("git");
  }

  // dbt-related keywords
  if (
    lowerQuery.includes("dbt") ||
    lowerQuery.includes("model") ||
    lowerQuery.includes("lineage") ||
    lowerQuery.includes("transform")
  ) {
    types.push("dbt");
  }

  // Metabase-related keywords
  if (
    lowerQuery.includes("metabase") ||
    lowerQuery.includes("dashboard") ||
    lowerQuery.includes("card") ||
    lowerQuery.includes("report")
  ) {
    types.push("metabase");
  }

  return types;
}

/**
 * Hook for tracking which evidence types user has explicitly requested.
 *
 * Implements EVID-06: Clean Slate experience.
 * - Fresh case shows no "missing evidence" warnings
 * - Warnings appear only after user requests specific evidence that fails to load
 *
 * @example
 * ```tsx
 * const { shouldShowMissingWarning, requestEvidenceType } = useCaseEvidenceState();
 *
 * // When user asks about git history
 * requestEvidenceType('git');
 *
 * // When rendering warnings
 * {shouldShowMissingWarning('git', hasGitEvidence) && (
 *   <Warning>{getMissingMessage('git')}</Warning>
 * )}
 * ```
 */
export function useCaseEvidenceState(): UseCaseEvidenceStateReturn {
  const [requestedTypes, setRequestedTypes] = useState<Set<EvidenceType>>(
    new Set(),
  );

  const requestEvidenceType = useCallback((type: EvidenceType) => {
    setRequestedTypes((prev) => {
      if (prev.has(type)) return prev;
      const next = new Set(prev);
      next.add(type);
      return next;
    });
  }, []);

  const requestEvidenceTypes = useCallback((types: EvidenceType[]) => {
    setRequestedTypes((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const type of types) {
        if (!next.has(type)) {
          next.add(type);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const hasRequestedType = useCallback(
    (type: EvidenceType) => requestedTypes.has(type),
    [requestedTypes],
  );

  const shouldShowMissingWarning = useCallback(
    (type: EvidenceType, evidenceExists: boolean): boolean => {
      // Only show warning if:
      // 1. User explicitly requested this type
      // 2. AND the evidence is missing (not exists)
      return requestedTypes.has(type) && !evidenceExists;
    },
    [requestedTypes],
  );

  const getMissingMessage = useCallback(
    (type: EvidenceType): string | null => {
      if (!requestedTypes.has(type)) return null;
      return EVIDENCE_MISSING_MESSAGES[type] || null;
    },
    [requestedTypes],
  );

  const resetRequestedTypes = useCallback(() => {
    setRequestedTypes(new Set());
  }, []);

  const inferTypesFromIntent = useCallback(
    (intent: string, query?: string) => {
      const intentTypes = getEvidenceTypesForIntent(intent);
      const queryTypes = query ? inferTypesFromQuery(query) : [];

      const allTypes = [...new Set([...intentTypes, ...queryTypes])];
      if (allTypes.length > 0) {
        requestEvidenceTypes(allTypes);
      }
    },
    [requestEvidenceTypes],
  );

  return useMemo(
    () => ({
      requestedTypes,
      requestEvidenceType,
      requestEvidenceTypes,
      hasRequestedType,
      shouldShowMissingWarning,
      getMissingMessage,
      resetRequestedTypes,
      inferTypesFromIntent,
    }),
    [
      requestedTypes,
      requestEvidenceType,
      requestEvidenceTypes,
      hasRequestedType,
      shouldShowMissingWarning,
      getMissingMessage,
      resetRequestedTypes,
      inferTypesFromIntent,
    ],
  );
}

export default useCaseEvidenceState;
