"use client";

import { useState } from "react";

interface GitFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  initialCredentials?: Record<string, string> | null;
  onTest: (formData: { config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  onSave: (formData: { name: string; config: Record<string, unknown>; credentials: Record<string, string> }) => void;
  testLoading?: boolean;
  saveLoading?: boolean;
  connectorName?: string;
}

export function GitForm({
  mode,
  initialConfig = {},
  initialCredentials = null,
  onTest,
  onSave,
  testLoading = false,
  saveLoading = false,
  connectorName = "",
}: GitFormProps) {
  const [name, setName] = useState(connectorName);
  const [repoPath, setRepoPath] = useState(String(initialConfig.repo_path ?? ""));
  const [branch, setBranch] = useState(String(initialConfig.branch ?? "main"));
  const [sshKey, setSshKey] = useState("");

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const buildConfig = () => ({
    repo_path: repoPath,
    branch,
  });

  const buildCredentials = () => {
    const creds: Record<string, string> = {};
    if (sshKey) creds.ssh_key = sshKey;
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
    (isEdit || name.trim().length > 0) && repoPath.trim().length > 0;

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
            placeholder="e.g. analytics-repo"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Repository Path <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.repo_path ?? "") : repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          disabled={isView}
          placeholder="/path/to/repo or https://github.com/org/repo"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Branch</label>
        <input
          type="text"
          value={isView ? String(initialConfig.branch ?? "") : branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={isView}
          placeholder="main"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          SSH Key <span className="text-xs text-muted-foreground">(optional, for private repos)</span>
        </label>
        {isView ? (
          <textarea
            value={initialCredentials?.ssh_key ?? ""}
            disabled
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed resize-none"
          />
        ) : (
          <textarea
            value={sshKey}
            onChange={(e) => setSshKey(e.target.value)}
            placeholder={isEdit ? "Enter new key or leave blank to keep existing" : "-----BEGIN OPENSSH PRIVATE KEY-----"}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        )}
      </div>

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
