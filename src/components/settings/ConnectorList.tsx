"use client";

import { formatDistanceToNow } from "date-fns";
import { Plus, Database, BarChart3, GitBranch, FolderCode } from "lucide-react";
import type { ConnectorConfigResponse, ConnectorType } from "@/hooks/useConnectorConfig";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ConnectorType, string> = {
  postgres: "PostgreSQL",
  metabase: "Metabase",
  dbt: "dbt",
  git: "Git",
};

const TYPE_ICONS: Record<ConnectorType, React.ReactNode> = {
  postgres: <Database className="h-4 w-4" />,
  metabase: <BarChart3 className="h-4 w-4" />,
  dbt: <FolderCode className="h-4 w-4" />,
  git: <GitBranch className="h-4 w-4" />,
};

function statusColor(status: string | null): string {
  if (status === "healthy") return "bg-green-500";
  if (status === "unhealthy") return "bg-red-500";
  return "bg-yellow-500";
}

function statusText(status: string | null): string {
  if (status === "healthy") return "Healthy";
  if (status === "unhealthy") return "Unhealthy";
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConnectorListProps {
  connectors: ConnectorConfigResponse[];
  selectedName: string | null;
  onSelect: (connector: ConnectorConfigResponse) => void;
  onAddNew: () => void;
  loading: boolean;
}

export function ConnectorList({
  connectors,
  selectedName,
  onSelect,
  onAddNew,
  loading,
}: ConnectorListProps) {
  if (loading) {
    return (
      <div className="flex w-80 flex-col border-r border-border/40">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Connectors</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-80 flex-col border-r border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Connectors</h2>
        <button
          onClick={onAddNew}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {connectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Database className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No connectors configured
            </p>
            <button
              onClick={onAddNew}
              className="mt-2 flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add connector
            </button>
          </div>
        ) : (
          <ul className="py-1">
            {connectors.map((connector) => {
              const isSelected = connector.name === selectedName;
              return (
                <li key={connector.name}>
                  <button
                    onClick={() => onSelect(connector)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-primary/5 border-l-2 border-primary"
                        : "hover:bg-accent border-l-2 border-transparent"
                    }`}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 text-muted-foreground">
                      {TYPE_ICONS[connector.type] ?? <Database className="h-4 w-4" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {connector.name}
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${statusColor(connector.health_status)}`}
                          title={statusText(connector.health_status)}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{TYPE_LABELS[connector.type] ?? connector.type}</span>
                        <span className="text-border">|</span>
                        <span>{statusText(connector.health_status)}</span>
                      </div>
                      {connector.last_sync_at && (
                        <div className="mt-0.5 text-xs text-muted-foreground/70">
                          Synced{" "}
                          {formatDistanceToNow(new Date(connector.last_sync_at), {
                            addSuffix: true,
                          })}
                          {connector.entity_count != null && (
                            <> &middot; {connector.entity_count} entities</>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
