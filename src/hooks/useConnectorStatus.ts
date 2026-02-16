"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";

/**
 * Status types for connectors
 */
export type ReadinessStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Connector status information matching backend ConnectorHealthResponse
 */
export interface ConnectorStatus {
  connector_id: string;
  name: string;
  type: string;
  status: ReadinessStatus;
  server_url: string;
  hostname: string;
  last_successful_fetch: string | null;
  last_check_at: string | null;
  last_sync_at: string | null;
  response_time_ms: number | null;
  error_message: string | null;
  capabilities: string[];
  entity_count: number | null;
}

/**
 * Overall readiness response from backend
 */
export interface ReadinessResponse {
  connectors: ConnectorStatus[];
  overall_status: ReadinessStatus;
  status_summary: string;
  checked_at: string;
}

/**
 * Parallel execution job status
 */
export interface ParallelExecutionJob {
  id: string;
  source: string;
  status: "pending" | "in_progress" | "done" | "error";
  progress?: number;
  error_message?: string;
}

/**
 * Get status color for traffic light display
 */
export function getStatusColor(
  status: ReadinessStatus,
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "healthy":
      return "green";
    case "degraded":
      return "yellow";
    case "unhealthy":
      return "red";
    case "unknown":
    default:
      return "gray";
  }
}

/**
 * Get CSS color class for status
 */
export function getStatusColorClass(status: ReadinessStatus): string {
  const colors: Record<ReadinessStatus, string> = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    unhealthy: "bg-red-500",
    unknown: "bg-gray-400",
  };
  return colors[status] || colors.unknown;
}

/**
 * Get text color class for status
 */
export function getStatusTextClass(status: ReadinessStatus): string {
  const colors: Record<ReadinessStatus, string> = {
    healthy: "text-green-700",
    degraded: "text-yellow-700",
    unhealthy: "text-red-700",
    unknown: "text-gray-500",
  };
  return colors[status] || colors.unknown;
}

/**
 * Format last fetch timestamp as relative time
 */
export function formatLastFetch(dateString: string | null): string {
  if (!dateString) return "Never";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Hook options for useConnectorStatus
 */
export interface UseConnectorStatusOptions {
  connectorName?: string;
  baseUrl?: string;
}

/**
 * Hook return type for useConnectorStatus
 */
export interface UseConnectorStatusReturn {
  connector: ConnectorStatus | null;
  connectors: ConnectorStatus[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  triggerManualCheck: (name?: string) => Promise<ConnectorStatus | null>;
}

/**
 * Hook for fetching connector status
 *
 * @param options - Configuration options
 * @returns Connector status data and control functions
 */
export function useConnectorStatus(
  options: UseConnectorStatusOptions = {},
): UseConnectorStatusReturn {
  const { connectorName, baseUrl = getApiBaseUrl() } = options;

  const [connector, setConnector] = useState<ConnectorStatus | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (connectorName) {
        // Fetch specific connector
        const response = await fetch(
          `${baseUrl}/api/readiness/${encodeURIComponent(connectorName)}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data: ConnectorStatus = await response.json();
        setConnector(data);
      } else {
        // Fetch all connectors
        const response = await fetch(`${baseUrl}/api/readiness`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data: ReadinessResponse = await response.json();
        setConnectors(data.connectors);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [connectorName, baseUrl]);

  const triggerManualCheck = useCallback(
    async (name?: string): Promise<ConnectorStatus | null> => {
      const targetName = name || connectorName;
      if (!targetName) {
        setError(new Error("No connector name specified"));
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${baseUrl}/api/readiness/check/${encodeURIComponent(targetName)}`,
          { method: "POST" },
        );

        if (response.status === 429) {
          const data = await response.json();
          throw new Error(data.detail || "Rate limited. Try again later.");
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ConnectorStatus = await response.json();

        // Update state
        if (connectorName) {
          setConnector(data);
        } else {
          // Update in the connectors list
          setConnectors((prev) =>
            prev.map((c) => (c.name === data.name ? data : c)),
          );
        }

        return data;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [connectorName, baseUrl],
  );

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    connector,
    connectors,
    isLoading,
    error,
    refresh,
    triggerManualCheck,
  };
}

/**
 * Hook options for useReadinessPolling
 */
export interface UseReadinessPollingOptions {
  interval?: number;
  baseUrl?: string;
  enabled?: boolean;
}

/**
 * Hook return type for useReadinessPolling
 */
export interface UseReadinessPollingReturn {
  connectors: ConnectorStatus[];
  overallStatus: ReadinessStatus;
  statusSummary: string;
  checkedAt: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for polling readiness status at regular intervals
 *
 * @param options - Configuration options
 * @returns Readiness data with auto-refresh
 */
export function useReadinessPolling(
  options: UseReadinessPollingOptions = {},
): UseReadinessPollingReturn {
  const { interval = 30000, baseUrl = getApiBaseUrl(), enabled = true } = options;

  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [overallStatus, setOverallStatus] = useState<ReadinessStatus>("unknown");
  const [statusSummary, setStatusSummary] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/readiness`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: ReadinessResponse = await response.json();

      setConnectors(data.connectors);
      setOverallStatus(data.overall_status);
      setStatusSummary(data.status_summary);
      setCheckedAt(data.checked_at);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, enabled]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    refresh();

    // Set up polling
    intervalRef.current = setInterval(refresh, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh, interval, enabled]);

  // Refresh on window focus
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh, enabled]);

  return {
    connectors,
    overallStatus,
    statusSummary,
    checkedAt,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for tracking parallel execution progress
 */
export interface UseParallelExecutionOptions {
  onComplete?: (jobs: ParallelExecutionJob[]) => void;
  onError?: (error: Error) => void;
}

export interface UseParallelExecutionReturn {
  jobs: ParallelExecutionJob[];
  isExecuting: boolean;
  startExecution: (jobIds: string[], sources: string[]) => void;
  updateJobStatus: (
    jobId: string,
    status: ParallelExecutionJob["status"],
    progress?: number,
    error?: string,
  ) => void;
  reset: () => void;
}

/**
 * Hook for tracking parallel skill execution progress
 *
 * Used to visualize multiple data sources being queried simultaneously.
 */
export function useParallelExecution(
  options: UseParallelExecutionOptions = {},
): UseParallelExecutionReturn {
  const { onComplete, onError } = options;

  const [jobs, setJobs] = useState<ParallelExecutionJob[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const startExecution = useCallback((jobIds: string[], sources: string[]) => {
    const newJobs: ParallelExecutionJob[] = jobIds.map((id, i) => ({
      id,
      source: sources[i] || id,
      status: "pending" as const,
    }));
    setJobs(newJobs);
    setIsExecuting(true);
  }, []);

  const updateJobStatus = useCallback(
    (
      jobId: string,
      status: ParallelExecutionJob["status"],
      progress?: number,
      errorMessage?: string,
    ) => {
      setJobs((prev) => {
        const updated = prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status,
                progress: progress ?? job.progress,
                error_message: errorMessage ?? job.error_message,
              }
            : job,
        );

        // Check if all done
        const allDone = updated.every(
          (j) => j.status === "done" || j.status === "error",
        );
        if (allDone) {
          setIsExecuting(false);
          const hasError = updated.some((j) => j.status === "error");
          if (hasError && onError) {
            onError(new Error("One or more parallel jobs failed"));
          } else if (onComplete) {
            onComplete(updated);
          }
        }

        return updated;
      });
    },
    [onComplete, onError],
  );

  const reset = useCallback(() => {
    setJobs([]);
    setIsExecuting(false);
  }, []);

  return {
    jobs,
    isExecuting,
    startExecution,
    updateJobStatus,
    reset,
  };
}

export default useConnectorStatus;
