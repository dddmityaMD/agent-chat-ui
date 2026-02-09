"use client";

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LLMHealthStatus } from "@/lib/types";

/** Overall status derived from all provider statuses */
export type OverallStatus = "healthy" | "degraded" | "unhealthy";

interface LLMHealthContextType {
  /** Per-provider health statuses keyed by provider name */
  statuses: Record<string, LLMHealthStatus>;
  /** Worst status across all providers */
  overallStatus: OverallStatus;
}

const LLMHealthContext = createContext<LLMHealthContextType | undefined>(
  undefined,
);

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 30_000;

import { getApiBaseUrl } from "@/lib/api-url";

const getBaseUrl = getApiBaseUrl;

/** Derive the worst status across all providers */
function deriveOverallStatus(
  statuses: Record<string, LLMHealthStatus>,
): OverallStatus {
  const values = Object.values(statuses);
  if (values.length === 0) return "healthy";
  if (values.some((s) => s.status === "unhealthy")) return "unhealthy";
  if (values.some((s) => s.status === "degraded")) return "degraded";
  return "healthy";
}

export function LLMHealthProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, LLMHealthStatus>>(
    {},
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/llm/health`);
      if (!res.ok) {
        // API unavailable -- default to healthy so UI is not alarming
        return;
      }
      const data = (await res.json()) as Record<string, LLMHealthStatus>;
      setStatuses(data);
    } catch {
      // Network error -- keep current statuses (default healthy on first load)
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchHealth, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchHealth]);

  const overallStatus = useMemo(
    () => deriveOverallStatus(statuses),
    [statuses],
  );

  const value = useMemo(
    () => ({ statuses, overallStatus }),
    [statuses, overallStatus],
  );

  return (
    <LLMHealthContext.Provider value={value}>
      {children}
    </LLMHealthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLLMHealth(): LLMHealthContextType {
  const ctx = useContext(LLMHealthContext);
  if (!ctx) {
    throw new Error("useLLMHealth must be used within an LLMHealthProvider");
  }
  return ctx;
}
