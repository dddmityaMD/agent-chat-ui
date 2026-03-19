"use client";

import { useState } from "react";

interface CsvFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  initialCredentials?: Record<string, string> | null;
  onTest: (formData: { config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  onSave: (formData: { name: string; config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  testLoading?: boolean;
  saveLoading?: boolean;
  connectorName?: string;
}

export function CsvForm({
  mode,
  initialConfig = {},
  initialCredentials = null,
  onTest,
  onSave,
  testLoading = false,
  saveLoading = false,
  connectorName = "",
}: CsvFormProps) {
  const [name, setName] = useState(connectorName);
  const [sourceDir, setSourceDir] = useState(String(initialConfig.source_dir ?? ""));
  const [targetDsn, setTargetDsn] = useState("");

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const buildConfig = () => ({
    source_dir: sourceDir,
  });

  const buildCredentials = () => {
    const creds: Record<string, string> = {};
    if (targetDsn) creds.target_dsn = targetDsn;
    return creds;
  };

  const handleTest = () => {
    onTest({ config: buildConfig(), credentials: buildCredentials() });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: isEdit ? connectorName : name,
      config: buildConfig(),
      credentials: buildCredentials(),
    });
  };

  const isValid =
    (isEdit || name.trim().length > 0) && sourceDir.trim().length > 0;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {mode === "create" && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. hotel-data-csv"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Source Directory <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.source_dir ?? "") : sourceDir}
          onChange={(e) => setSourceDir(e.target.value)}
          disabled={isView}
          placeholder="/path/to/csv/files"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Directory containing .csv files to discover and load
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Target PostgreSQL DSN{" "}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        {isView ? (
          <input
            type="text"
            value={initialCredentials?.target_dsn ?? ""}
            disabled
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
          />
        ) : (
          <input
            type="text"
            value={targetDsn}
            onChange={(e) => setTargetDsn(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep existing" : "postgresql://user:pass@host:5432/db"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Defaults to BI_POSTGRES_DSN if not set
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testLoading}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {testLoading ? "Testing..." : "Test Connection"}
        </button>
        {!isView && (
          <button
            type="submit"
            disabled={!isValid || saveLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saveLoading ? "Saving..." : "Save"}
          </button>
        )}
      </div>
    </form>
  );
}
