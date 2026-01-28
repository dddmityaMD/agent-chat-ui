"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { useCases, CaseSummary } from "@/providers/Cases";
import { useStreamContext } from "@/providers/Stream";
import { cn } from "@/lib/utils";
import { EvidenceViewer, LinkedEvidence, EvidenceItem } from "@/components/evidence-viewer";

type Check = { id: string; label: string; ok: boolean };

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

function computeChecks(summary: CaseSummary | null): {
  checks: Check[];
  missing: string[];
} {
  const ev = (summary?.evidence ?? []) as Array<Record<string, unknown>>;
  const types = new Set(ev.map((e) => String(e.type ?? "")));

  const checks: Check[] = [
    { id: "sql", label: "SQL evidence", ok: types.has("SQL_QUERY_RESULT") },
    { id: "git", label: "Git evidence", ok: types.has("GIT_DIFF") },
    { id: "dbt", label: "dbt artifacts", ok: types.has("DBT_ARTIFACT") },
    { id: "metabase", label: "Metabase API", ok: types.has("API_RESPONSE") },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.id);
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
  const [caseId] = useQueryState("caseId");
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"findings" | "evidence">("findings");

  const refreshKey = useMemo(
    () => `${caseId ?? ""}:${stream.messages.length}:${stream.isLoading ? 1 : 0}`,
    [caseId, stream.isLoading, stream.messages.length],
  );

  useEffect(() => {
    let cancelled = false;
    if (!caseId) {
      setSummary(null);
      setFindings(null);
      setError(null);
      return;
    }
    setLoading(true);
    
    // Fetch both summary and findings
    Promise.all([
      getCaseSummary(caseId),
      getFindings(caseId).catch(() => null),
    ])
      .then(([s, f]) => {
        if (cancelled) return;
        setSummary(s);
        setFindings(f?.latest as Findings | null);
        setError(null);
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
  }, [caseId, getCaseSummary, getFindings, refreshKey]);

  const { checks, missing } = useMemo(() => computeChecks(summary), [summary]);
  const mismatch = useMemo(() => computeMismatch(summary), [summary]);

  return (
    <div className={cn("h-full overflow-y-auto p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Case</div>
          <div className="text-xs text-muted-foreground">
            {caseId ? caseId.slice(0, 8) + "..." : "(none selected)"}
          </div>
        </div>
        {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Readiness Section */}
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Readiness</div>
            <div className="rounded-md border bg-white p-3">
              <div className="mt-1 grid gap-1">
                {checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className={c.ok ? "text-green-700" : "text-amber-700"}>
                      {c.ok ? "OK" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mismatch Section */}
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Mismatch</div>
            <div className="rounded-md border bg-white p-3">
              {Object.keys(mismatch).length === 0 ? (
                <div className="text-sm text-muted-foreground">No comparison data yet</div>
              ) : (
                Object.entries(mismatch).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="capitalize">{key.replace(/_/g, " ")}: </span>
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
                  : "text-muted-foreground"
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
                  : "text-muted-foreground"
              )}
              onClick={() => setActiveTab("evidence")}
            >
              Evidence ({(summary.evidence ?? []).length})
            </button>
          </div>

          {/* Findings Tab */}
          {activeTab === "findings" && (
            <div className="mt-3 grid gap-3">
              {/* Root Cause */}
              {findings?.root_cause ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <div className="text-sm font-semibold text-green-800">Root Cause</div>
                  <div className="mt-1 text-sm">{findings.root_cause.statement}</div>
                  <div className="mt-1 text-xs text-green-700">
                    Confidence: {Math.round(findings.root_cause.confidence * 100)}%
                  </div>
                  <LinkedEvidence
                    evidenceIds={findings.root_cause.evidence_ids}
                    allEvidence={(summary.evidence ?? []) as unknown as EvidenceItem[]}
                  />
                </div>
              ) : (
                <div className="rounded-md border bg-white p-3">
                  <div className="text-sm font-semibold">Root Cause</div>
                  <div className="mt-1 text-sm text-muted-foreground">Not yet identified</div>
                </div>
              )}

              {/* Key Observations */}
              {findings?.key_observations && findings.key_observations.length > 0 && (
                <div className="rounded-md border bg-white p-3">
                  <div className="text-sm font-semibold">Key Observations</div>
                  <ul className="mt-2 space-y-3">
                    {findings.key_observations.map((obs, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <div className="flex-1">
                            <span>{obs.statement}</span>
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({Math.round(obs.confidence * 100)}%)
                            </span>
                            <LinkedEvidence
                              evidenceIds={obs.evidence_ids}
                              allEvidence={(summary.evidence ?? []) as unknown as EvidenceItem[]}
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
                  <div className="text-sm font-semibold text-blue-800">Recommended Fix</div>
                  <ol className="mt-2 list-inside list-decimal space-y-1">
                    {findings.recommended_fix.steps.map((step, i) => (
                      <li key={i} className="text-sm">{step}</li>
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
              {findings?.recommended_next_tests && findings.recommended_next_tests.length > 0 && (
                <div className="rounded-md border bg-white p-3">
                  <div className="text-sm font-semibold">Next Steps</div>
                  <ul className="mt-2 space-y-2">
                    {findings.recommended_next_tests.map((test, i) => (
                      <li key={i} className="text-sm">
                        <div className="font-medium">{test.test}</div>
                        <div className="text-xs text-muted-foreground">{test.why}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Open Questions */}
              {findings?.open_questions && findings.open_questions.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-semibold text-amber-800">Open Questions</div>
                  <ul className="mt-2 space-y-2">
                    {findings.open_questions.map((q, i) => (
                      <li key={i} className="text-sm">
                        <div className="font-medium">{q.question}</div>
                        <div className="text-xs text-amber-700">{q.why_missing}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No findings yet */}
              {!findings && (
                <div className="rounded-md border bg-white p-3">
                  <div className="text-sm text-muted-foreground">
                    No findings yet. Start an investigation to generate findings.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evidence Tab */}
          {activeTab === "evidence" && (
            <div className="mt-3 space-y-2">
              {(summary.evidence ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-white">
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
        </>
      )}
    </div>
  );
}
