"use client";

import { useState } from "react";

interface PostgresFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  initialCredentials?: Record<string, string> | null;
  onTest: (formData: { config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  onSave: (formData: { name: string; config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  testLoading?: boolean;
  saveLoading?: boolean;
  connectorName?: string;
}

export function PostgresForm({
  mode,
  initialConfig = {},
  initialCredentials = null,
  onTest,
  onSave,
  testLoading = false,
  saveLoading = false,
  connectorName = "",
}: PostgresFormProps) {
  const [name, setName] = useState(connectorName);
  const [host, setHost] = useState(String(initialConfig.host ?? "localhost"));
  const [port, setPort] = useState(String(initialConfig.port ?? "5432"));
  const [database, setDatabase] = useState(String(initialConfig.database ?? ""));
  const [user, setUser] = useState(String(initialConfig.user ?? ""));
  const [password, setPassword] = useState("");
  const [sslMode, setSslMode] = useState(String(initialConfig.ssl_mode ?? "prefer"));

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const buildConfig = () => ({
    host,
    port: parseInt(port, 10) || 5432,
    database,
    user,
    ssl_mode: sslMode,
  });

  const buildCredentials = () => {
    const creds: Record<string, string> = {};
    if (password) creds.password = password;
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
    (isEdit || name.trim().length > 0) &&
    host.trim().length > 0 &&
    database.trim().length > 0 &&
    user.trim().length > 0 &&
    (mode !== "create" || password.length > 0);

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Name */}
      {mode === "create" && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. production-db"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>
      )}

      {/* Host */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Host <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.host ?? "") : host}
          onChange={(e) => setHost(e.target.value)}
          disabled={isView}
          placeholder="localhost"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
      </div>

      {/* Port */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Port</label>
        <input
          type="number"
          value={isView ? String(initialConfig.port ?? "") : port}
          onChange={(e) => setPort(e.target.value)}
          disabled={isView}
          placeholder="5432"
          min={1}
          max={65535}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Database */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Database <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.database ?? "") : database}
          onChange={(e) => setDatabase(e.target.value)}
          disabled={isView}
          placeholder="mydb"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
      </div>

      {/* User */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          User <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.user ?? "") : user}
          onChange={(e) => setUser(e.target.value)}
          disabled={isView}
          placeholder="postgres"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Password {mode === "create" && <span className="text-destructive">*</span>}
        </label>
        {isView ? (
          <input
            type="text"
            value={initialCredentials?.password ?? ""}
            disabled
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
          />
        ) : (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Enter new value or leave blank to keep existing" : ""}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            required={mode === "create"}
          />
        )}
      </div>

      {/* SSL Mode */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">SSL Mode</label>
        <select
          value={isView ? String(initialConfig.ssl_mode ?? "prefer") : sslMode}
          onChange={(e) => setSslMode(e.target.value)}
          disabled={isView}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="disable">disable</option>
          <option value="allow">allow</option>
          <option value="prefer">prefer</option>
          <option value="require">require</option>
        </select>
      </div>

      {/* Buttons */}
      {!isView && (
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testLoading}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {testLoading ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="submit"
            disabled={!isValid || saveLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saveLoading ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}
