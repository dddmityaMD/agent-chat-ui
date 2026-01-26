"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { useCases, CaseSummary } from "@/providers/Cases";
import { useStreamContext } from "@/providers/Stream";
import { cn } from "@/lib/utils";

type Check = { id: string; label: string; ok: boolean };

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

function computeMismatch(summary: CaseSummary | null): {
  expected?: string;
  reported?: string;
} {
  const ev = (summary?.evidence ?? []) as Array<Record<string, any>>;
  let expected: string | undefined;
  let reported: string | undefined;
  for (const e of ev) {
    if (String(e.type ?? "") !== "SQL_QUERY_RESULT") continue;
    const payload = (e.payload ?? {}) as any;
    const rows = (payload.rows ?? []) as any[];
    const row0 = rows[0] as any;
    if (!row0 || typeof row0 !== "object") continue;
    if (row0.expected_total_sales != null) expected = String(row0.expected_total_sales);
    if (row0.reported_total_sales != null) reported = String(row0.reported_total_sales);
  }
  return { expected, reported };
}

export function CasePanel({ className }: { className?: string }) {
  const { getCaseSummary } = useCases();
  const stream = useStreamContext();
  const [caseId] = useQueryState("caseId");
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshKey = useMemo(
    () => `${caseId ?? ""}:${stream.messages.length}:${stream.isLoading ? 1 : 0}`,
    [caseId, stream.isLoading, stream.messages.length],
  );

  useEffect(() => {
    let cancelled = false;
    if (!caseId) {
      setSummary(null);
      setError(null);
      return;
    }
    setLoading(true);
    getCaseSummary(caseId)
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load");
        setSummary(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, getCaseSummary, refreshKey]);

  const { checks, missing } = useMemo(() => computeChecks(summary), [summary]);
  const mismatch = useMemo(() => computeMismatch(summary), [summary]);

  return (
    <div className={cn("h-full overflow-y-auto p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Case</div>
          <div className="text-xs text-muted-foreground">
            {caseId ? caseId : "(none selected)"}
          </div>
        </div>
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <>
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Readiness</div>
            <div className="rounded-md border bg-white p-3">
              <div className="text-xs text-muted-foreground">
                intent: recommend_root_cause
              </div>
              <div className="mt-2 grid gap-1">
                {checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className={c.ok ? "text-green-700" : "text-amber-700"}>
                      {c.ok ? "OK" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
              {!!missing.length && (
                <div className="mt-2 text-xs text-amber-700">
                  Missing: {missing.join(", ")}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Mismatch</div>
            <div className="rounded-md border bg-white p-3">
              <div className="text-sm">
                Expected: <span className="font-mono">{mismatch.expected ?? "—"}</span>
              </div>
              <div className="text-sm">
                Reported: <span className="font-mono">{mismatch.reported ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold">Evidence</div>
            <div className="rounded-md border bg-white p-3">
              {(summary.evidence ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No evidence yet.</div>
              ) : (
                <div className="grid gap-2">
                  {(summary.evidence ?? []).slice(0, 25).map((e: any) => (
                    <div key={String(e.evidence_id ?? e.title ?? Math.random())}>
                      <div className="text-sm font-medium">
                        {String(e.title ?? e.type ?? "Evidence")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {String(e.type ?? "")} {e.created_at ? `· ${String(e.created_at)}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
