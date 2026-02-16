"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// Types matching backend ConnectorConfigResponse / TestConnectionResponse / SyncResponse
// ---------------------------------------------------------------------------

export type ConnectorType = "postgres" | "metabase" | "dbt" | "git";

export interface ConnectorConfigResponse {
  name: string;
  type: ConnectorType;
  enabled: boolean;
  config: Record<string, unknown>;
  credentials: Record<string, string> | null;
  health_status: string | null;
  last_check_at: string | null;
  last_sync_at: string | null;
  entity_count: number | null;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  details: string | null;
}

export interface SyncResponse {
  success: boolean;
  entity_count: number | null;
  message: string;
}

export interface ConnectorConfigCreate {
  name: string;
  type: ConnectorType;
  config: Record<string, unknown>;
  credentials: Record<string, string> | null;
  enabled?: boolean;
}

export interface ConnectorConfigUpdate {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, string> | null;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConnectorConfig() {
  const [connectors, setConnectors] = useState<ConnectorConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = getApiBaseUrl();

  const fetchConnectors = useCallback(async (): Promise<ConnectorConfigResponse[]> => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${base}/api/connectors/config`, {
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error(`Failed to fetch connectors: ${resp.status}`);
      }
      const data: ConnectorConfigResponse[] = await resp.json();
      setConnectors(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [base]);

  const createConnector = useCallback(
    async (data: ConnectorConfigCreate): Promise<ConnectorConfigResponse> => {
      const resp = await fetch(`${base}/api/connectors/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
        throw new Error(body.detail || `Failed to create connector: ${resp.status}`);
      }
      const created: ConnectorConfigResponse = await resp.json();
      setConnectors((prev) => [...prev, created]);
      return created;
    },
    [base],
  );

  const updateConnector = useCallback(
    async (name: string, data: ConnectorConfigUpdate): Promise<ConnectorConfigResponse> => {
      const resp = await fetch(`${base}/api/connectors/config/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
        throw new Error(body.detail || `Failed to update connector: ${resp.status}`);
      }
      const updated: ConnectorConfigResponse = await resp.json();
      setConnectors((prev) =>
        prev.map((c) => (c.name === name ? updated : c)),
      );
      return updated;
    },
    [base],
  );

  const deleteConnector = useCallback(
    async (name: string): Promise<void> => {
      const resp = await fetch(`${base}/api/connectors/config/${encodeURIComponent(name)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
        throw new Error(body.detail || `Failed to delete connector: ${resp.status}`);
      }
      setConnectors((prev) => prev.filter((c) => c.name !== name));
    },
    [base],
  );

  const testConnection = useCallback(
    async (name: string): Promise<TestConnectionResponse> => {
      const resp = await fetch(
        `${base}/api/connectors/config/${encodeURIComponent(name)}/test`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
        throw new Error(body.detail || `Test connection failed: ${resp.status}`);
      }
      return resp.json();
    },
    [base],
  );

  const triggerSync = useCallback(
    async (name: string): Promise<SyncResponse> => {
      const resp = await fetch(
        `${base}/api/connectors/config/${encodeURIComponent(name)}/sync`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
        throw new Error(body.detail || `Sync trigger failed: ${resp.status}`);
      }
      return resp.json();
    },
    [base],
  );

  const pollConnector = useCallback(
    async (name: string): Promise<ConnectorConfigResponse> => {
      const resp = await fetch(
        `${base}/api/connectors/config/${encodeURIComponent(name)}`,
        {
          credentials: "include",
        },
      );
      if (!resp.ok) {
        throw new Error(`Failed to poll connector: ${resp.status}`);
      }
      const data: ConnectorConfigResponse = await resp.json();
      // Update connector in local state
      setConnectors((prev) =>
        prev.map((c) => (c.name === name ? data : c)),
      );
      return data;
    },
    [base],
  );

  // Auto-fetch on mount
  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  return {
    connectors,
    loading,
    error,
    fetchConnectors,
    createConnector,
    updateConnector,
    deleteConnector,
    testConnection,
    triggerSync,
    pollConnector,
  };
}
