"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Setup status response from /api/setup/status
 */
export interface SetupStatus {
  has_connectors: boolean;
  healthy_connectors: number;
  synced_connectors: number;
  total_connectors: number;
  is_ready: boolean;
}

/**
 * Return type for useSetupStatus hook
 */
export interface UseSetupStatusReturn {
  data: SetupStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching /api/setup/status endpoint
 *
 * Auto-fetches on mount and polls every 30 seconds to detect
 * new connectors configured in another tab.
 *
 * @param pollingInterval - Polling interval in ms (default: 30000)
 */
export function useSetupStatus(
  pollingInterval: number = 30000,
): UseSetupStatusReturn {
  const [data, setData] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/setup/status`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SetupStatus = await response.json();
      setData(result);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  // Initial fetch and polling setup with cleanup
  useEffect(() => {
    fetchStatus();

    intervalRef.current = setInterval(fetchStatus, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStatus, pollingInterval]);

  return { data, loading, error, refetch };
}

export default useSetupStatus;
