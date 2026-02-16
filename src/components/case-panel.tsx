"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryState } from "nuqs";
import { useStreamContext } from "@/providers/Stream";
import { usePermissionState } from "@/providers/Thread";
import { cn } from "@/lib/utils";
import {
  EvidenceViewer,
  LinkedEvidence,
  EvidenceItem,
} from "@/components/evidence-viewer";
import {
  useCaseEvidenceState,
  EVIDENCE_TYPE_MAP,
  EVIDENCE_TYPE_LABELS,
  type EvidenceType,
} from "@/hooks/useCaseEvidenceState";
import { ReadinessPanel } from "@/components/readiness/ReadinessPanel";
import { Copy, X, Filter } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { ContextPanelSection } from "@/components/context-panel";
import { getApiBaseUrl } from "@/lib/api-url";
import { toast } from "sonner";
import { useSaisUi } from "@/hooks/useSaisUi";
import { useAuth } from "@/providers/Auth";
import { TAB_CONFIG, TabTrigger } from "@/components/case-panel/tabs";
import type { TabValue } from "@/components/case-panel/tabs";
import { SummaryTab } from "@/components/case-panel/summary-tab";
import { CostTab } from "@/components/case-panel/cost-tab";
import { LINEAGE_NAVIGATE_EVENT } from "@/components/lineage-link";
import type { LineageNavigateDetail } from "@/components/lineage-link";

// Lazy-load LineageGraph to avoid pulling React Flow into the initial bundle
const LineageGraph = lazy(() => import("@/components/lineage/LineageGraph"));

type Check = { id: string; label: string; ok: boolean; requested: boolean };

// ---------------------------------------------------------------------------
// Thread Summary types (local to this component, matches backend ThreadSummaryOut)
// ---------------------------------------------------------------------------

interface ThreadMeta {
  thread_id: string;
  workspace_id: string | null;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  last_activity_at: string;
  last_message_preview: string | null;
}

export interface ThreadSummary {
  thread: ThreadMeta;
  evidence: Array<Record<string, unknown>>;
  hypotheses: Array<Record<string, unknown>>;
  findings: Record<string, unknown> | null;
}

// Types for findings
interface RootCause {
  statement: string;
  confidence: number;
  evidence_ids: string[];
}

interface Observation {
  statement: string;
  evidence_ids: string[];
  confidence: number;
}

interface RecommendedFix {
  steps: string[];
  risks: string[];
  validation_steps: string[];
}

interface NextTest {
  test: string;
  why: string;
  tool_candidates: string[];
}

interface OpenQuestion {
  question: string;
  why_missing: string;
  tool_candidates: string[];
}

export interface Findings {
  root_cause: RootCause | null;
  key_observations: Observation[];
  rejected_hypotheses: any[];
  recommended_fix: RecommendedFix | null;
  recommended_next_tests: NextTest[];
  open_questions: OpenQuestion[];
}

function computeChecks(
  summary: ThreadSummary | null,
  requestedTypes: Set<EvidenceType>,
): {
  checks: Check[];
  missing: string[];
} {
  const ev = (summary?.evidence ?? []) as Array<Record<string, unknown>>;
  const types = new Set(ev.map((e) => String(e.type ?? "")));

  const checkTypes: { id: EvidenceType; label: string; evidenceType: string }[] = [
    { id: "sql", label: EVIDENCE_TYPE_LABELS.sql, evidenceType: EVIDENCE_TYPE_MAP.sql },
    { id: "git", label: EVIDENCE_TYPE_LABELS.git, evidenceType: EVIDENCE_TYPE_MAP.git },
    { id: "dbt", label: EVIDENCE_TYPE_LABELS.dbt, evidenceType: EVIDENCE_TYPE_MAP.dbt },
    { id: "metabase", label: EVIDENCE_TYPE_LABELS.metabase, evidenceType: EVIDENCE_TYPE_MAP.metabase },
  ];

  const checks: Check[] = checkTypes.map((c) => ({
    id: c.id,
    label: c.label,
    ok: types.has(c.evidenceType),
    requested: requestedTypes.has(c.id),
  }));

  const missing = checks.filter((c) => c.requested && !c.ok).map((c) => c.id);
  return { checks, missing };
}

function computeMismatch(summary: ThreadSummary | null): Record<string, string> {
  const ev = (summary?.evidence ?? []) as Array<Record<string, any>>;
  const mismatch: Record<string, string> = {};
  const patterns = [
    ["expected", "reported"],
    ["source", "target"],
    ["actual", "calculated"],
    ["raw", "aggregated"],
  ];

  for (const e of ev) {
    if (String(e.type ?? "") !== "SQL_QUERY_RESULT") continue;
    const rows = (e.payload?.rows ?? []) as any[];
    if (!rows[0]) continue;

    for (const [col, val] of Object.entries(rows[0])) {
      const colLower = (col as string).toLowerCase();
      for (const [p1, p2] of patterns) {
        if (colLower.includes(p1) || colLower.includes(p2)) {
          if (val != null) mismatch[col] = String(val);
        }
      }
    }
  }
  return mismatch;
}

// ---------------------------------------------------------------------------
// API helpers -- direct fetch from /api/threads
// ---------------------------------------------------------------------------

async function fetchThreadSummary(
  threadId: string,
  setSessionExpired: (expired: boolean) => void,
): Promise<ThreadSummary | null> {
  const res = await fetch(`${getApiBaseUrl()}/api/threads/${threadId}/summary`, { credentials: "include" });
  if (res.status === 401) { setSessionExpired(true); return null; }
  // Gracefully handle 404/500 for newly-created threads where registration
  // may not have completed yet (UX-06). Return null instead of throwing --
  // the summary will be fetched again when the stream completes.
  if (!res.ok) {
    console.warn(`[case-panel] Thread summary fetch returned ${res.status} for ${threadId}, returning empty`);
    return null;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// CasePanel (thread-scoped)
// ---------------------------------------------------------------------------

export function CasePanel({ className }: { className?: string }) {
  const stream = useStreamContext();
  const { permissionState, revokePermissionGrant } = usePermissionState();
  const { setSessionExpired } = useAuth();
  const [threadId] = useQueryState("threadId");
  const saisUiData = useSaisUi();
  const [casePanelSection, setCasePanelSection] = useQueryState("casePanelSection");
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("summary");
  const [lineageFilter, setLineageFilter] = useState<{ entities: string[] } | null>(null);

  // Listen for lineage navigation events from AI messages (cross-component communication)
  useEffect(() => {
    function handleLineageNavigate(e: Event) {
      const detail = (e as CustomEvent<LineageNavigateDetail>).detail;
      if (detail?.entities?.length > 0) {
        setLineageFilter({ entities: detail.entities });
        setActiveTab("lineage");
      }
    }
    window.addEventListener(LINEAGE_NAVIGATE_EVENT, handleLineageNavigate);
    return () => window.removeEventListener(LINEAGE_NAVIGATE_EVENT, handleLineageNavigate);
  }, []);

  // Clean slate experience: Track which evidence types user has requested
  const {
    requestedTypes,
    shouldShowMissingWarning,
    getMissingMessage,
    resetRequestedTypes,
    inferTypesFromIntent,
  } = useCaseEvidenceState();

  // Track loading->idle transitions to refetch only when stream completes
  const wasStreamingRef = useRef(false);
  const prevThreadIdRef = useRef(threadId);

  const doFetch = useCallback(async (tid: string) => {
    setLoading(true);
    try {
      const s = await fetchThreadSummary(tid, setSessionExpired);
      if (!s) return; // 401 handled -- modal already showing
      setSummary(s);
      setFindings(s.findings as Findings | null);
      setError(null);

      const currentIntent = saisUiData.raw?.intent;
      if (typeof currentIntent === "string") {
        inferTypesFromIntent(currentIntent);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setSummary(null);
      setFindings(null);
    } finally {
      setLoading(false);
    }
  }, [saisUiData.raw, inferTypesFromIntent, setSessionExpired]);

  useEffect(() => {
    if (!threadId) {
      setSummary(null);
      setFindings(null);
      setError(null);
      resetRequestedTypes();
      setActiveTab("summary"); // Reset tab on thread clear
      setLineageFilter(null); // Clear lineage filter on thread clear
      prevThreadIdRef.current = threadId;
      return;
    }

    const threadChanged = threadId !== prevThreadIdRef.current;
    const streamJustFinished = wasStreamingRef.current && !stream.isLoading;

    if (stream.isLoading) {
      wasStreamingRef.current = true;
    }

    if (!threadChanged && !streamJustFinished) {
      if (summary !== null) return;
    }

    // Reset to summary tab and clear lineage filter when switching threads
    if (threadChanged) {
      setActiveTab("summary");
      setLineageFilter(null);
    }

    if (streamJustFinished) {
      wasStreamingRef.current = false;
    }
    prevThreadIdRef.current = threadId;

    doFetch(threadId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, stream.isLoading, resetRequestedTypes, doFetch]);

  useEffect(() => {
    if (casePanelSection !== "permissions") return;
    // Navigate to summary tab where permissions live, then scroll
    setActiveTab("summary");
    const section = document.getElementById("permissions-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCasePanelSection(null);
  }, [casePanelSection, setCasePanelSection]);

  const { checks, missing: _missing } = useMemo(
    () => computeChecks(summary, requestedTypes),
    [summary, requestedTypes],
  );
  const mismatch = useMemo(() => computeMismatch(summary), [summary]);

  // Badge counts (non-zero only)
  const evidenceCount = (summary?.evidence ?? []).length;
  const findingsCount = findings
    ? (findings.key_observations?.length ?? 0) + (findings.root_cause ? 1 : 0)
    : 0;

  const getBadgeCount = (tabValue: string): number | undefined => {
    switch (tabValue) {
      case "evidence": return evidenceCount > 0 ? evidenceCount : undefined;
      case "findings": return findingsCount > 0 ? findingsCount : undefined;
      default: return undefined;
    }
  };

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <Tabs.Root
        value={activeTab}
        onValueChange={(v: string) => setActiveTab(v as TabValue)}
        className="flex h-full flex-col"
      >
        {/* Tab bar */}
        <Tabs.List
          className="flex shrink-0 gap-0 overflow-x-auto border-b px-2"
          aria-label="Thread details"
        >
          {TAB_CONFIG.map((tab) => (
            <TabTrigger
              key={tab.value}
              config={tab}
              badgeCount={getBadgeCount(tab.value)}
            />
          ))}
        </Tabs.List>

        {/* Tab content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary Tab */}
          <Tabs.Content value="summary" className="p-4">
            <SummaryTab
              threadId={threadId}
              summary={summary}
              loading={loading}
              error={error}
              checks={checks}
              mismatch={mismatch}
              requestedTypes={requestedTypes}
              shouldShowMissingWarning={shouldShowMissingWarning}
              getMissingMessage={getMissingMessage}
              permissionState={permissionState}
              revokePermissionGrant={revokePermissionGrant}
              stream={stream}
            />
          </Tabs.Content>

          {/* Evidence Tab */}
          <Tabs.Content value="evidence" className="p-4">
            {summary ? (
              <div
                data-testid="evidence-panel"
                className="space-y-2"
              >
                {(summary.evidence ?? []).length === 0 ? (
                  <div className="text-muted-foreground rounded-md border bg-card p-3 text-sm">
                    No evidence yet.
                  </div>
                ) : (
                  (summary.evidence ?? []).slice(0, 25).map((e: any, idx: number) => (
                    <EvidenceViewer
                      key={String(e.evidence_id ?? e.title ?? `ev-${idx}`)}
                      evidence={e as EvidenceItem}
                      defaultExpanded={false}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No thread selected.</div>
            )}
          </Tabs.Content>

          {/* Findings Tab */}
          <Tabs.Content value="findings" className="p-4">
            {summary ? (
              <div className="grid gap-3">
                {/* Root Cause */}
                {findings?.root_cause ? (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3">
                    <div className="text-sm font-semibold text-green-800">
                      Root Cause
                    </div>
                    <div className="mt-1 text-sm">
                      {findings.root_cause.statement}
                    </div>
                    <div className="mt-1 text-xs text-green-700">
                      Confidence:{" "}
                      {Math.round(findings.root_cause.confidence * 100)}%
                    </div>
                    <LinkedEvidence
                      evidenceIds={findings.root_cause.evidence_ids}
                      allEvidence={
                        (summary.evidence ?? []) as unknown as EvidenceItem[]
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-card p-3">
                    <div className="text-sm font-semibold">Root Cause</div>
                    <div className="text-muted-foreground mt-1 text-sm">
                      Not yet identified
                    </div>
                  </div>
                )}

                {/* Key Observations */}
                {findings?.key_observations &&
                  findings.key_observations.length > 0 && (
                    <div className="rounded-md border bg-card p-3">
                      <div className="text-sm font-semibold">
                        Key Observations
                      </div>
                      <ul className="mt-2 space-y-3">
                        {findings.key_observations.map((obs, i) => (
                          <li
                            key={i}
                            className="text-sm"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground">&#8226;</span>
                              <div className="flex-1">
                                <span>{obs.statement}</span>
                                <span className="text-muted-foreground ml-1 text-xs">
                                  ({Math.round(obs.confidence * 100)}%)
                                </span>
                                <LinkedEvidence
                                  evidenceIds={obs.evidence_ids}
                                  allEvidence={
                                    (summary.evidence ??
                                      []) as unknown as EvidenceItem[]
                                  }
                                />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Recommended Fix */}
                {findings?.recommended_fix && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                    <div className="text-sm font-semibold text-blue-800">
                      Recommended Fix
                    </div>
                    <ol className="mt-2 list-inside list-decimal space-y-1">
                      {findings.recommended_fix.steps.map((step, i) => (
                        <li
                          key={i}
                          className="text-sm"
                        >
                          {step}
                        </li>
                      ))}
                    </ol>
                    {findings.recommended_fix.risks.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700">
                        Risks: {findings.recommended_fix.risks.join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Next Tests */}
                {findings?.recommended_next_tests &&
                  findings.recommended_next_tests.length > 0 && (
                    <div className="rounded-md border bg-card p-3">
                      <div className="text-sm font-semibold">Next Steps</div>
                      <ul className="mt-2 space-y-2">
                        {findings.recommended_next_tests.map((test, i) => (
                          <li
                            key={i}
                            className="text-sm"
                          >
                            <div className="font-medium">{test.test}</div>
                            <div className="text-muted-foreground text-xs">
                              {test.why}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Open Questions */}
                {findings?.open_questions &&
                  findings.open_questions.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <div className="text-sm font-semibold text-amber-800">
                        Open Questions
                      </div>
                      <ul className="mt-2 space-y-2">
                        {findings.open_questions.map((q, i) => (
                          <li
                            key={i}
                            className="text-sm"
                          >
                            <div className="font-medium">{q.question}</div>
                            <div className="text-xs text-amber-700">
                              {q.why_missing}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* No findings yet */}
                {!findings && (
                  <div className="rounded-md border bg-card p-3">
                    <div className="text-muted-foreground text-sm">
                      No findings yet. Start an investigation to generate
                      findings.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No thread selected.</div>
            )}
          </Tabs.Content>

          {/* Lineage Tab */}
          <Tabs.Content value="lineage" className="p-4">
            {summary ? (
              <div
                data-testid="lineage-panel"
                className="flex flex-1 flex-col"
                style={{ minHeight: "400px" }}
              >
                {/* Lineage filter chip */}
                {lineageFilter && lineageFilter.entities.length > 0 && (
                  <div
                    className="mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950"
                    data-testid="lineage-filter"
                  >
                    <Filter className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      Showing lineage for:{" "}
                      <span className="font-medium">
                        {lineageFilter.entities.join(", ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLineageFilter(null)}
                      className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
                      data-testid="lineage-filter-clear"
                      title="Clear filter to show full lineage graph"
                    >
                      <X className="h-3 w-3" />
                      Clear filter
                    </button>
                  </div>
                )}
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading lineage graph...
                    </div>
                  }
                >
                  <LineageGraph
                    className="h-full min-h-[400px] rounded-md border bg-card"
                  />
                </Suspense>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No thread selected.</div>
            )}
          </Tabs.Content>

          {/* Cost Tab */}
          <Tabs.Content value="cost" className="p-4">
            <CostTab threadId={threadId ?? undefined} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
