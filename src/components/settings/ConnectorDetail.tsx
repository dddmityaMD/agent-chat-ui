"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Pencil, Trash2, Database, BarChart3, GitBranch, FolderCode } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import type {
  ConnectorConfigResponse,
  ConnectorConfigCreate,
  ConnectorConfigUpdate,
  ConnectorType,
  TestConnectionResponse,
  SyncResponse,
} from "@/hooks/useConnectorConfig";
import type { DetailMode } from "@/app/settings/connectors/page";
import { PostgresForm } from "./forms/PostgresForm";
import { MetabaseForm } from "./forms/MetabaseForm";
import { DbtForm } from "./forms/DbtForm";
import { GitForm } from "./forms/GitForm";
import { ConnectorTestResult } from "./ConnectorTestResult";
import { ConnectorSyncProgress, type SyncStatus } from "./ConnectorSyncProgress";
import { DeleteConnectorDialog } from "./DeleteConnectorDialog";

// ---------------------------------------------------------------------------
// Type selector card
// ---------------------------------------------------------------------------

const CONNECTOR_TYPES: {
  type: ConnectorType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "postgres",
    label: "PostgreSQL",
    description: "Connect to a PostgreSQL database",
    icon: <Database className="h-6 w-6" />,
  },
  {
    type: "metabase",
    label: "Metabase",
    description: "Connect to a Metabase instance",
    icon: <BarChart3 className="h-6 w-6" />,
  },
  {
    type: "dbt",
    label: "dbt",
    description: "Connect to a dbt project",
    icon: <FolderCode className="h-6 w-6" />,
  },
  {
    type: "git",
    label: "Git",
    description: "Connect to a Git repository",
    icon: <GitBranch className="h-6 w-6" />,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectorDetailProps {
  connector: ConnectorConfigResponse | null;
  mode: DetailMode;
  connectors: ConnectorConfigResponse[];
  onSave: (connector: ConnectorConfigResponse, testPassed?: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  onCancel: () => void;
  createConnector: (data: ConnectorConfigCreate) => Promise<ConnectorConfigResponse>;
  updateConnector: (name: string, data: ConnectorConfigUpdate) => Promise<ConnectorConfigResponse>;
  deleteConnector: (name: string) => Promise<void>;
  testConnection: (name: string) => Promise<TestConnectionResponse>;
  triggerSync: (name: string) => Promise<SyncResponse>;
  pollConnector: (name: string) => Promise<ConnectorConfigResponse>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectorDetail({
  connector,
  mode,
  connectors,
  onSave,
  onDelete,
  onEdit,
  onCancel,
  createConnector,
  updateConnector,
  deleteConnector,
  testConnection,
  triggerSync,
  pollConnector,
}: ConnectorDetailProps) {
  const [selectedType, setSelectedType] = useState<ConnectorType | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncEntityCount, setSyncEntityCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Track mount state for async operations
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset state when connector or mode changes
  useEffect(() => {
    setTestResult(null);
    setTestLoading(false);
    setSaveError(null);
    setSyncStatus("idle");
    setSyncEntityCount(null);
    setSyncError(null);
    setDeleteError(null);
    if (mode === "create") {
      setSelectedType(null);
    }
  }, [connector?.name, mode]);

  const connectorType = connector?.type ?? selectedType;

  const availablePostgresConnectors = connectors.filter(
    (c) => c.type === "postgres",
  );

  // Track last test result for conditional sync
  const lastTestPassedRef = useRef(false);

  // ----- Test Connection -----
  const handleTest = useCallback(
    async (formData: { config: Record<string, unknown>; credentials: Record<string, string> }) => {
      if (!connector && !selectedType) return;

      setTestLoading(true);
      setTestResult(null);
      lastTestPassedRef.current = false;

      try {
        // View mode on saved connector: use named endpoint (tests saved config)
        // Create/edit mode: always use inline endpoint with current form values
        const useNamedEndpoint = mode === "view" && !!connector?.name;

        if (useNamedEndpoint) {
          const result = await testConnection(connector!.name);
          if (mountedRef.current) {
            setTestResult(result);
            lastTestPassedRef.current = result.success;
          }
        } else {
          const type = selectedType ?? connector?.type;
          if (!type) return;
          const base = getApiBaseUrl();
          const res = await fetch(`${base}/api/connectors/config/test-inline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              type,
              config: formData.config,
              credentials: formData.credentials,
              connector_name: connector?.name ?? null,
            }),
          });
          const result = await res.json();
          if (mountedRef.current) {
            setTestResult(result);
            lastTestPassedRef.current = result.success;
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setTestResult({
            success: false,
            message: err instanceof Error ? err.message : "Test failed",
            details: null,
          });
        }
      } finally {
        if (mountedRef.current) {
          setTestLoading(false);
        }
      }
    },
    [connector, selectedType, mode, testConnection],
  );

  // ----- Save -----
  const handleSave = useCallback(
    async (formData: {
      name: string;
      config: Record<string, unknown>;
      credentials: Record<string, string>;
    }) => {
      setSaveLoading(true);
      setSaveError(null);

      try {
        let saved: ConnectorConfigResponse;

        if (mode === "create") {
          if (!selectedType) return;
          saved = await createConnector({
            name: formData.name,
            type: selectedType,
            config: formData.config,
            credentials: Object.keys(formData.credentials).length > 0 ? formData.credentials : null,
          });
        } else {
          if (!connector) return;
          const update: ConnectorConfigUpdate = {
            config: formData.config,
          };
          if (Object.keys(formData.credentials).length > 0) {
            update.credentials = formData.credentials;
          }
          saved = await updateConnector(connector.name, update);
        }

        // Only auto-sync if test passed
        const testPassed = lastTestPassedRef.current;
        if (mountedRef.current) {
          onSave(saved, testPassed);
          if (!testPassed) {
            // Skip sync — test didn't pass
            return;
          }
          setSyncStatus("syncing");
        }

        // Background sync + polling
        try {
          await triggerSync(saved.name);
          // Poll for completion (up to 30s)
          let attempts = 0;
          const maxAttempts = 15;
          while (attempts < maxAttempts && mountedRef.current) {
            await new Promise((r) => setTimeout(r, 2000));
            attempts++;
            const polled = await pollConnector(saved.name);
            if (polled.last_sync_at && polled.entity_count != null) {
              if (mountedRef.current) {
                setSyncStatus("complete");
                setSyncEntityCount(polled.entity_count);
              }
              return;
            }
          }
          // Timeout — still show as complete (sync may finish later)
          if (mountedRef.current) {
            setSyncStatus("complete");
            setSyncEntityCount(null);
          }
        } catch {
          if (mountedRef.current) {
            setSyncStatus("error");
            setSyncError("Sync failed");
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setSaveError(err instanceof Error ? err.message : "Save failed");
        }
      } finally {
        if (mountedRef.current) {
          setSaveLoading(false);
        }
      }
    },
    [mode, connector, selectedType, createConnector, updateConnector, triggerSync, pollConnector, onSave],
  );

  // ----- Delete -----
  const handleDeleteConfirm = useCallback(async () => {
    if (!connector) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteConnector(connector.name);
      setDeleteOpen(false);
      onDelete();
    } catch (err) {
      if (mountedRef.current) {
        setDeleteError(err instanceof Error ? err.message : "Delete failed");
      }
    } finally {
      if (mountedRef.current) {
        setDeleteLoading(false);
      }
    }
  }, [connector, deleteConnector, onDelete]);

  // ----- Type selector (create mode, no type selected yet) -----
  if (mode === "create" && !selectedType) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Add Connector</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a connector type to get started.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {CONNECTOR_TYPES.map((ct) => (
            <button
              key={ct.type}
              onClick={() => setSelectedType(ct.type)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="text-muted-foreground">{ct.icon}</div>
              <span className="text-sm font-medium text-foreground">{ct.label}</span>
              <span className="text-xs text-muted-foreground">{ct.description}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- Form rendering -----
  const formMode = mode === "create" ? "create" : mode === "edit" ? "edit" : "view";

  const renderForm = () => {
    const commonProps = {
      mode: formMode as "create" | "edit" | "view",
      initialConfig: connector?.config ?? {},
      initialCredentials: connector?.credentials ?? null,
      onTest: handleTest,
      onSave: handleSave,
      testLoading,
      saveLoading,
      connectorName: connector?.name ?? "",
    };

    switch (connectorType) {
      case "postgres":
        return <PostgresForm {...commonProps} />;
      case "metabase":
        return <MetabaseForm {...commonProps} />;
      case "dbt":
        return (
          <DbtForm
            {...commonProps}
            availablePostgresConnectors={availablePostgresConnectors}
          />
        );
      case "git":
        return <GitForm {...commonProps} />;
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Unknown connector type: {connectorType}
          </p>
        );
    }
  };

  const typeLabel =
    CONNECTOR_TYPES.find((ct) => ct.type === connectorType)?.label ?? connectorType;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "create"
              ? `New ${typeLabel} Connector`
              : connector?.name ?? "Connector"}
          </h2>
          {mode !== "create" && connector && (
            <p className="mt-0.5 text-sm text-muted-foreground">{typeLabel}</p>
          )}
        </div>

        {mode === "view" && connector && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}

        {mode === "edit" && (
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        )}

        {mode === "create" && selectedType && (
          <button
            onClick={() => setSelectedType(null)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Back
          </button>
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* Form */}
      <div className="mt-6">{renderForm()}</div>

      {/* Test result */}
      <div className="mt-4">
        <ConnectorTestResult
          result={testResult}
          loading={testLoading}
          onDismiss={() => setTestResult(null)}
        />
      </div>

      {/* Sync progress */}
      <div className="mt-3">
        <ConnectorSyncProgress
          status={syncStatus}
          entityCount={syncEntityCount}
          errorMessage={syncError}
        />
      </div>

      {/* Delete dialog */}
      {connector && (
        <DeleteConnectorDialog
          open={deleteOpen}
          connectorName={connector.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteError(null);
          }}
          loading={deleteLoading}
          errorMessage={deleteError}
        />
      )}
    </div>
  );
}
