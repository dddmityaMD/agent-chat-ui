"use client";

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CaseRow = {
  case_id: string;
  title: string;
  status: "open" | "paused" | "closed";
  current_phase?: string | null;
  current_intent?: string | null;
  last_thread_id?: string | null;
  last_opened_at?: string | null;
  created_at: string;
  closed_at?: string | null;
};

export type CaseSummary = {
  case: CaseRow;
  nodes: Array<Record<string, unknown>>;
  hypotheses: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  readiness?: Record<string, unknown>;
};

export type FindingsResponse = {
  findings: Array<{
    findings_id: string;
    case_id: string;
    version: number;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  latest: Record<string, unknown> | null;
};

type CasesContextType = {
  cases: CaseRow[];
  refresh: () => Promise<void>;
  createCase: (title?: string) => Promise<CaseRow>;
  deleteCase: (caseId: string) => Promise<void>;
  getCaseSummary: (caseId: string) => Promise<CaseSummary>;
  getFindings: (caseId: string) => Promise<FindingsResponse>;
};

const CasesContext = createContext<CasesContextType | undefined>(undefined);

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CASES_API_URL;

  // In dev/compose, the frontend may be accessed either from the host (localhost)
  // or from within the compose network (service DNS like "frontend").
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (envUrl && envUrl.includes("localhost") && host !== "localhost" && host !== "127.0.0.1") {
      return "http://api:8000";
    }
  }

  return (envUrl || "http://localhost:8000").replace(/\/$/, "");
}

export function CasesProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<CaseRow[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch(`${getBaseUrl()}/cases`);
    if (!res.ok) throw new Error("Failed to list cases");
    const data = (await res.json()) as CaseRow[];
    setCases(data);
  }, []);

  const createCase = useCallback(async (title?: string) => {
    const res = await fetch(`${getBaseUrl()}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title ?? "" }),
    });
    if (!res.ok) throw new Error("Failed to create case");
    const row = (await res.json()) as CaseRow;
    await refresh();
    return row;
  }, [refresh]);

  const deleteCase = useCallback(
    async (caseId: string) => {
      const res = await fetch(`${getBaseUrl()}/cases/${caseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete case");
      await refresh();
    },
    [refresh],
  );

  const getCaseSummary = useCallback(async (caseId: string) => {
    const res = await fetch(`${getBaseUrl()}/cases/${caseId}/summary`);
    if (!res.ok) throw new Error("Failed to fetch case summary");
    return (await res.json()) as CaseSummary;
  }, []);

  const getFindings = useCallback(async (caseId: string) => {
    const res = await fetch(`${getBaseUrl()}/cases/${caseId}/findings`);
    if (!res.ok) throw new Error("Failed to fetch findings");
    return (await res.json()) as FindingsResponse;
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      // ignore; UI can still be used without cases api
    });
  }, [refresh]);

  const value = useMemo(
    () => ({ cases, refresh, createCase, deleteCase, getCaseSummary, getFindings }),
    [cases, refresh, createCase, deleteCase, getCaseSummary, getFindings],
  );

  return <CasesContext.Provider value={value}>{children}</CasesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) throw new Error("useCases must be used within CasesProvider");
  return ctx;
}
