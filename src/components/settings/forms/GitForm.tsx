"use client";

import { useState } from "react";

interface GitFormProps {
  mode: "create" | "edit" | "view";
  initialConfig?: Record<string, unknown>;
  initialCredentials?: Record<string, string> | null;
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
  const [repoPath, setRepoPath] = useState(
    String(initialConfig.repo_path ?? ""),
  );
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
            placeholder="e.g. analytics-repo"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            required
          />
        </div>
      )}

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          Repository Path <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.repo_path ?? "") : repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          disabled={isView}
          placeholder="/path/to/repo or https://github.com/org/repo"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          required
        />
      </div>

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          Branch
        </label>
        <input
          type="text"
          value={isView ? String(initialConfig.branch ?? "") : branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={isView}
          placeholder="main"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label className="text-foreground mb-1 block text-sm font-medium">
          SSH Key{" "}
          <span className="text-muted-foreground text-xs">
            (optional, for private repos)
          </span>
        </label>
        {isView ? (
          <textarea
            value={initialCredentials?.ssh_key ?? ""}
            disabled
            rows={3}
            className="border-border bg-background text-muted-foreground w-full resize-none rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : (
          <textarea
            value={sshKey}
            onChange={(e) => setSshKey(e.target.value)}
            placeholder={
              isEdit
                ? "Enter new key or leave blank to keep existing"
                : "-----BEGIN OPENSSH PRIVATE KEY-----"
            }
            rows={3}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
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
