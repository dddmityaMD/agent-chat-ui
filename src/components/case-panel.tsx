"use client";

import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useQueryState } from "nuqs";
import { useCases, CaseSummary } from "@/providers/Cases";
import { useStreamContext } from "@/providers/Stream";
import { usePermissionState } from "@/providers/Thread";
import { cn } from "@/lib/utils";
import {
  EvidenceViewer,
  LinkedEvidence,
  EvidenceItem,
} from "@/components/evidence-viewer";
import { getStatusColor } from "@/components/tables/cell-renderers/BadgeCell";
import {
  useCaseEvidenceState,
  EVIDENCE_TYPE_MAP,
  EVIDENCE_TYPE_LABELS,
  type EvidenceType,
} from "@/hooks/useCaseEvidenceState";
import { ReadinessPanel } from "@/components/readiness/ReadinessPanel";
import { Network } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// Lazy-load LineageGraph to avoid pulling React Flow into the initial bundle
const LineageGraph = lazy(() => import("@/components/lineage/LineageGraph"));

type Check = { id: string; label: string; ok: boolean; requested: boolean };

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

interface Findings {
  root_cause: RootCause | null;
  key_observations: Observation[];
  rejected_hypotheses: any[];
  recommended_fix: RecommendedFix | null;
  recommended_next_tests: NextTest[];
  open_questions: OpenQuestion[];
}

function computeChecks(
  summary: CaseSummary | null,
  requestedTypes: Set<EvidenceType>,
): {
  checks: Check[];
  missing: string[];
} {
  const ev = (summary?.evidence ?? []) as Array<Record<string, unknown>>;
  const types = new Set(ev.map((e) => String(e.type ?? "")));

  // Define all check types
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

  // Only include as "missing" if both requested AND not found
  const missing = checks.filter((c) => c.requested && !c.ok).map((c) => c.id);
  return { checks, missing };
}

function computeMismatch(summary: CaseSummary | null): Record<string, string> {
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

export function CasePanel({ className }: { className?: string }) {
  const { getCaseSummary, getFindings } = useCases();
  const stream = useStreamContext();
  const { permissionState, revokePermissionGrant } = usePermissionState();
  const [caseId] = useQueryState("caseId");
  const [casePanelSection, setCasePanelSection] = useQueryState("casePanelSection");
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "findings" | "evidence" | "lineage"
  >("findings");

  // Clean slate experience: Track which evidence types user has requested
  const {
    requestedTypes,
    shouldShowMissingWarning,
    getMissingMessage,
    resetRequestedTypes,
    inferTypesFromIntent,
  } = useCaseEvidenceState();

  const refreshKey = useMemo(
    () =>
      `${caseId ?? ""}:${stream.messages.length}:${stream.isLoading ? 1 : 0}`,
    [caseId, stream.isLoading, stream.messages.length],
  );

  useEffect(() => {
    let cancelled = false;
    if (!caseId) {
      setSummary(null);
      setFindings(null);
      setError(null);
      resetRequestedTypes(); // Reset on case change - clean slate
      return;
    }
    setLoading(true);

    // Fetch both summary and findings
    Promise.all([getCaseSummary(caseId), getFindings(caseId).catch(() => null)])
      .then(([s, f]) => {
        if (cancelled) return;
        setSummary(s);
        setFindings(f?.latest as Findings | null);
        setError(null);

        // Infer requested types from current intent if available
        const currentIntent = s?.case?.current_intent;
        if (currentIntent) {
          inferTypesFromIntent(currentIntent);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load");
        setSummary(null);
        setFindings(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, getCaseSummary, getFindings, refreshKey, resetRequestedTypes, inferTypesFromIntent]);

  useEffect(() => {
    if (casePanelSection !== "permissions") return;
    const section = document.getElementById("permissions-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCasePanelSection(null);
  }, [casePanelSection, setCasePanelSection]);

  const { checks, missing: _missing } = useMemo(
    () => computeChecks(summary, requestedTypes),
    [summary, requestedTypes],
  );
  const mismatch = useMemo(() => computeMismatch(summary), [summary]);

  return (
    <div className={cn("h-full overflow-y-auto p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Case</span>
            {summary && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  getStatusColor(summary.case.status),
                )}
                data-testid="case-status-badge"
              >
                {summary.case.status}
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {caseId ? caseId.slice(0, 8) + "..." : "(none selected)"}
          </div>
        </div>
        {loading && (
          <div className="text-muted-foreground text-xs">Loading...</div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Readiness Section - Full ReadinessPanel with connector health (EVID-05) */}
          <div className="mt-4">
            <ReadinessPanel
              showParallelExecution={true}
              enabled={!!summary}
              className="border-0 shadow-none"
            />
          </div>

          {/* Evidence Type Checklist - Clean Slate (EVID-06) */}
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Evidence Status</div>
            <div className="rounded-md border bg-white p-3">
              <div className="mt-1 grid gap-1">
                {checks.map((c) => {
                  // Clean slate: Only show "Missing" status if user explicitly requested this type
                  const showMissing = shouldShowMissingWarning(c.id as EvidenceType, c.ok);
                  const missingMessage = getMissingMessage(c.id as EvidenceType);

                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{c.label}</span>
                      <span
                        className={cn(
                          c.ok && "text-green-700",
                          showMissing && "text-amber-700",
                          !c.ok && !showMissing && "text-gray-400",
                        )}
                        title={showMissing ? missingMessage || undefined : undefined}
                      >
                        {c.ok ? "OK" : showMissing ? "Not found" : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Show subtle message if no evidence types requested yet */}
              {requestedTypes.size === 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  Ask a question to check for relevant evidence
                </div>
              )}
            </div>
          </div>

          <div
            id="permissions-section"
            className="mt-4 grid gap-2"
            data-testid="permissions-section"
          >
            <div className="text-sm font-semibold">Permissions</div>
            <div className="rounded-md border bg-white p-3">
              {permissionState.grants.length === 0 ? (
                <div className="text-muted-foreground text-sm">No active grants</div>
              ) : (
                <div className="space-y-2">
                  {permissionState.grants.map((grant) => (
                    <div
                      key={`${grant.pending_action_id ?? "grant"}-${grant.granted_at}`}
                      className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-amber-900">
                            {grant.capability.toUpperCase()} ({grant.scope})
                          </div>
                          <div className="text-xs text-amber-800">
                            Granted: {new Date(grant.granted_at).toLocaleString()}
                          </div>
                          {grant.expires_at && (
                            <div className="text-xs text-amber-800">
                              Expires: {new Date(grant.expires_at).toLocaleString()}
                            </div>
                          )}
                          {grant.reason && (
                            <div className="mt-1 text-xs text-amber-800">Reason: {grant.reason}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          onClick={() => {
                            revokePermissionGrant(grant.pending_action_id);
                            const text = `deny write${grant.pending_action_id ? ` pending_action_id=${grant.pending_action_id}` : ""}`;
                            stream.submit(
                              {
                                messages: [
                                  ...stream.messages,
                                  {
                                    id: uuidv4(),
                                    type: "human",
                                    content: [{ type: "text", text }],
                                  },
                                ],
                              } as Record<string, unknown> as any,
                              {
                                streamMode: ["values"],
                                streamSubgraphs: true,
                                streamResumable: true,
                              },
                            );
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mismatch Section */}
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Mismatch</div>
            <div className="rounded-md border bg-white p-3">
              {Object.keys(mismatch).length === 0 ? (
                <div className="text-muted-foreground text-sm">
                  No comparison data yet
                </div>
              ) : (
                Object.entries(mismatch).map(([key, value]) => (
                  <div
                    key={key}
                    className="text-sm"
                  >
                    <span className="capitalize">
                      {key.replace(/_/g, " ")}:{" "}
                    </span>
                    <span className="font-mono">{value ?? "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tab Selector */}
          <div className="mt-4 flex gap-2 border-b">
            <button
              className={cn(
                "px-3 py-1 text-sm",
                activeTab === "findings"
                  ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                  : "text-muted-foreground",
              )}
              onClick={() => setActiveTab("findings")}
            >
              Findings
            </button>
            <button
              data-testid="evidence-tab"
              className={cn(
                "px-3 py-1 text-sm",
                activeTab === "evidence"
                  ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                  : "text-muted-foreground",
              )}
              onClick={() => setActiveTab("evidence")}
            >
              Evidence ({(summary.evidence ?? []).length})
            </button>
            <button
              data-testid="lineage-tab"
              className={cn(
                "flex items-center gap-1 px-3 py-1 text-sm",
                activeTab === "lineage"
                  ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                  : "text-muted-foreground",
              )}
              onClick={() => setActiveTab("lineage")}
            >
              <Network className="h-3.5 w-3.5" />
              Lineage
            </button>
          </div>

          {/* Findings Tab */}
          {activeTab === "findings" && (
            <div className="mt-3 grid gap-3">
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
                <div className="rounded-md border bg-white p-3">
                  <div className="text-sm font-semibold">Root Cause</div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    Not yet identified
                  </div>
                </div>
              )}

              {/* Key Observations */}
              {findings?.key_observations &&
                findings.key_observations.length > 0 && (
                  <div className="rounded-md border bg-white p-3">
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
                            <span className="text-muted-foreground">•</span>
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
                  <div className="rounded-md border bg-white p-3">
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
                <div className="rounded-md border bg-white p-3">
                  <div className="text-muted-foreground text-sm">
                    No findings yet. Start an investigation to generate
                    findings.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evidence Tab */}
          {activeTab === "evidence" && (
            <div
              data-testid="evidence-panel"
              className="mt-3 space-y-2"
            >
              {(summary.evidence ?? []).length === 0 ? (
                <div className="text-muted-foreground rounded-md border bg-white p-3 text-sm">
                  No evidence yet.
                </div>
              ) : (
                (summary.evidence ?? []).slice(0, 25).map((e: any) => (
                  <EvidenceViewer
                    key={String(e.evidence_id ?? e.title ?? Math.random())}
                    evidence={e as EvidenceItem}
                    defaultExpanded={false}
                  />
                ))
              )}
            </div>
          )}

          {/* Lineage Tab */}
          {activeTab === "lineage" && (
            <div
              data-testid="lineage-panel"
              className="mt-3 flex flex-1 flex-col"
              style={{ minHeight: "400px" }}
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading lineage graph...
                  </div>
                }
              >
                <LineageGraph
                  className="h-full min-h-[400px] rounded-md border bg-white"
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </div>
  );
}
