"use client";

import { useState } from "react";

interface MetabaseFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  initialCredentials?: Record<string, string> | null;
  onTest: (formData: { config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  onSave: (formData: { name: string; config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  testLoading?: boolean;
  saveLoading?: boolean;
  connectorName?: string;
}

export function MetabaseForm({
  mode,
  initialConfig = {},
  initialCredentials = null,
  onTest,
  onSave,
  testLoading = false,
  saveLoading = false,
  connectorName = "",
}: MetabaseFormProps) {
  const [name, setName] = useState(connectorName);
  const [host, setHost] = useState(String(initialConfig.host ?? "localhost"));
  const [port, setPort] = useState(String(initialConfig.port ?? "3000"));
  const [username, setUsername] = useState(String(initialConfig.username ?? ""));
  const [password, setPassword] = useState("");
  const [useHttps, setUseHttps] = useState(Boolean(initialConfig.use_https));

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const buildConfig = () => ({
    host,
    port: parseInt(port, 10) || 3000,
    username,
    use_https: useHttps,
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
    (mode !== "create" || password.length > 0);

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
            placeholder="e.g. metabase-prod"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>
      )}

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

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Port</label>
        <input
          type="number"
          value={isView ? String(initialConfig.port ?? "") : port}
          onChange={(e) => setPort(e.target.value)}
          disabled={isView}
          placeholder="3000"
          min={1}
          max={65535}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Username</label>
        <input
          type="text"
          value={isView ? String(initialConfig.username ?? "") : username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isView}
          placeholder="admin@example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

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

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="use_https"
          checked={isView ? Boolean(initialConfig.use_https) : useHttps}
          onChange={(e) => setUseHttps(e.target.checked)}
          disabled={isView}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50 disabled:opacity-60"
        />
        <label htmlFor="use_https" className="text-sm text-foreground">
          Use HTTPS
        </label>
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
