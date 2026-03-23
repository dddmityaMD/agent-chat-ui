"use client";

import { useState } from "react";
import type { ConnectorConfigResponse } from "@/hooks/useConnectorConfig";

interface DbtFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  onTest: (formData: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
  }) => void;
  onSave: (formData: {
    name: string;
    config: Record<string, unknown>;
    credentials: Record<string, string>;
  }) => void;
  testLoading?: boolean;
  saveLoading?: boolean;
  connectorName?: string;
  availablePostgresConnectors: ConnectorConfigResponse[];
}

export function DbtForm({
  mode,
  initialConfig = {},
  onTest,
  onSave,
  testLoading = false,
  saveLoading = false,
  connectorName = "",
  availablePostgresConnectors,
}: DbtFormProps) {
  const [name, setName] = useState(connectorName);
  const [projectPath, setProjectPath] = useState(
    String(initialConfig.project_path ?? ""),
  );
  const [profilesDir, setProfilesDir] = useState(
    String(initialConfig.profiles_dir ?? ""),
  );
  const [target, setTarget] = useState(String(initialConfig.target ?? "dev"));
  const [selectedPgConnector, setSelectedPgConnector] = useState(
    String(initialConfig.postgres_connector ?? ""),
  );

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const buildConfig = () => {
    const cfg: Record<string, unknown> = {
      project_path: projectPath,
      target,
    };
    if (profilesDir) cfg.profiles_dir = profilesDir;
    if (selectedPgConnector) cfg.postgres_connector = selectedPgConnector;
    return cfg;
  };

  const handleTest = () => {
    onTest({ config: buildConfig(), credentials: {} });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: isEdit ? connectorName : name,
      config: buildConfig(),
      credentials: {},
    });
  };

  const isValid =
    (isEdit || name.trim().length > 0) && projectPath.trim().length > 0;

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4"
    >
      {mode === "create" && (
        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. dbt-analytics"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            required
          />
        </div>
      )}

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          Project Path <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={
            isView ? String(initialConfig.project_path ?? "") : projectPath
          }
          onChange={(e) => setProjectPath(e.target.value)}
          disabled={isView}
          placeholder="/path/to/dbt/project"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          required
        />
      </div>

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          Profiles Directory
        </label>
        <input
          type="text"
          value={
            isView ? String(initialConfig.profiles_dir ?? "") : profilesDir
          }
          onChange={(e) => setProfilesDir(e.target.value)}
          disabled={isView}
          placeholder="/path/to/profiles (optional)"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          Target
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.target ?? "") : target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={isView}
          placeholder="dev"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {/* PostgreSQL connector selector */}
      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          PostgreSQL Connector
        </label>
        {availablePostgresConnectors.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            No PostgreSQL connectors found. Add one first.
          </p>
        ) : isView ? (
          <input
            type="text"
            value={String(initialConfig.postgres_connector ?? "")}
            disabled
            className="border-border bg-background text-muted-foreground w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : (
          <select
            value={selectedPgConnector}
            onChange={(e) => setSelectedPgConnector(e.target.value)}
            className="border-border bg-background text-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">-- Select a PostgreSQL connector --</option>
            {availablePostgresConnectors.map((pg) => (
              <option
                key={pg.name}
                value={pg.name}
              >
                {pg.name}{" "}
                {pg.health_status === "healthy"
                  ? "(healthy)"
                  : pg.health_status === "unhealthy"
                    ? "(unhealthy)"
                    : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testLoading}
          className="border-border text-foreground hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {testLoading ? "Testing..." : "Test Connection"}
        </button>
        {!isView && (
          <button
            type="submit"
            disabled={!isValid || saveLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saveLoading ? "Saving..." : "Save"}
          </button>
        )}
      </div>
    </form>
  );
}
