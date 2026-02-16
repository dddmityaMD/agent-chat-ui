"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ConnectorList } from "@/components/settings/ConnectorList";
import { ConnectorDetail } from "@/components/settings/ConnectorDetail";
import {
  useConnectorConfig,
  type ConnectorConfigResponse,
} from "@/hooks/useConnectorConfig";

export type DetailMode = "view" | "edit" | "create";

export default function ConnectorsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      }
    >
      <ConnectorsPageContent />
    </Suspense>
  );
}

function ConnectorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get("selected");

  const {
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
  } = useConnectorConfig();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [mode, setMode] = useState<DetailMode>("view");
  const [paramHandled, setParamHandled] = useState(false);

  // Handle URL query param `?selected=` once connectors are loaded
  useEffect(() => {
    if (paramHandled || loading || !selectedParam) return;

    if (connectors.length > 0) {
      const match = connectors.find((c) => c.name === selectedParam);
      if (match) {
        setSelectedName(match.name);
        setMode("view");
      } else {
        // Stale link — clear param
        router.replace("/settings/connectors", { scroll: false });
      }
      setParamHandled(true);
    }
  }, [connectors, loading, selectedParam, paramHandled, router]);

  const selectedConnector = connectors.find((c) => c.name === selectedName) ?? null;

  const handleSelect = useCallback((connector: ConnectorConfigResponse) => {
    setSelectedName(connector.name);
    setMode("view");
  }, []);

  const handleAddNew = useCallback(() => {
    setSelectedName(null);
    setMode("create");
  }, []);

  const handleSaved = useCallback(
    (connector: ConnectorConfigResponse, testPassed?: boolean) => {
      setSelectedName(connector.name);
      setMode("view");
      // Only auto-sync if test passed
      if (testPassed) {
        triggerSync(connector.name).catch(() => {
          // Sync failure is non-blocking
        });
      }
    },
    [triggerSync],
  );

  const handleDeleted = useCallback(() => {
    setSelectedName(null);
    setMode("view");
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (selectedConnector) {
      setMode("view");
    } else {
      setSelectedName(null);
      setMode("view");
    }
  }, [selectedConnector]);

  return (
    <div className="flex h-full -m-6">
      <ConnectorList
        connectors={connectors}
        selectedName={selectedName}
        onSelect={handleSelect}
        onAddNew={handleAddNew}
        loading={loading}
      />

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {mode === "create" ? (
          <ConnectorDetail
            connector={null}
            mode="create"
            connectors={connectors}
            onSave={handleSaved}
            onDelete={handleDeleted}
            onEdit={() => setMode("edit")}
            onCancel={handleCancelEdit}
            createConnector={createConnector}
            updateConnector={updateConnector}
            deleteConnector={deleteConnector}
            testConnection={testConnection}
            triggerSync={triggerSync}
            pollConnector={pollConnector}
          />
        ) : selectedConnector ? (
          <ConnectorDetail
            connector={selectedConnector}
            mode={mode}
            connectors={connectors}
            onSave={handleSaved}
            onDelete={handleDeleted}
            onEdit={() => setMode("edit")}
            onCancel={handleCancelEdit}
            createConnector={createConnector}
            updateConnector={updateConnector}
            deleteConnector={deleteConnector}
            testConnection={testConnection}
            triggerSync={triggerSync}
            pollConnector={pollConnector}
          />
        ) : !loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a connector or add a new one
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
