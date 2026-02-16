"use client";

import type {
  ConnectorConfigResponse,
  ConnectorConfigCreate,
  ConnectorConfigUpdate,
  TestConnectionResponse,
  SyncResponse,
} from "@/hooks/useConnectorConfig";
import type { DetailMode } from "@/app/settings/connectors/page";

// Stub — will be replaced in Task 2 with full implementation
interface ConnectorDetailProps {
  connector: ConnectorConfigResponse | null;
  mode: DetailMode;
  connectors: ConnectorConfigResponse[];
  onSave: (connector: ConnectorConfigResponse) => void;
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

export function ConnectorDetail({ connector, mode }: ConnectorDetailProps) {
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        {mode === "create"
          ? "Add a new connector"
          : connector
            ? `Viewing ${connector.name}`
            : "Select a connector"}
      </p>
    </div>
  );
}
