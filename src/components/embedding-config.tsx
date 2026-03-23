"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();

interface EmbeddingHealth {
  node: { total: number; current: number; stale: number };
  learning: { total: number; current: number; stale: number };
  skill_embedding: { total: number; current: number; stale: number };
}

interface EmbeddingConfigData {
  provider: string;
  model: string;
  model_id: string;
  api_key_set: boolean;
  health: EmbeddingHealth;
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI", defaultModel: "text-embedding-3-small" },
  {
    value: "ollama_cloud",
    label: "Ollama Cloud",
    defaultModel: "qwen3-embedding",
  },
] as const;

function healthTotal(h: EmbeddingHealth) {
  return h.node.total + h.learning.total + h.skill_embedding.total;
}
function healthCurrent(h: EmbeddingHealth) {
  return h.node.current + h.learning.current + h.skill_embedding.current;
}
function hasStale(h: EmbeddingHealth) {
  return (
    h.node.stale > 0 || h.learning.stale > 0 || h.skill_embedding.stale > 0
  );
}

export function EmbeddingConfigSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EmbeddingConfigData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draftProvider, setDraftProvider] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [draftApiKey, setDraftApiKey] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);

  const [reembedding, setReembedding] = useState(false);
  const [progress, setProgress] = useState<EmbeddingHealth | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API}/api/embedding/config`);
      if (!res.ok) {
        const err = await res.text();
        setFetchError(`Failed to load embedding config: ${err}`);
        return;
      }
      const data: EmbeddingConfigData = await res.json();
      setConfig(data);
      setDraftProvider(data.provider);
      setDraftModel(data.model);
      setDraftApiKey("");
    } catch (e) {
      setFetchError(`Failed to load embedding config: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchConfig();
  }, [isOpen, fetchConfig]);

  const startPolling = useCallback(() => {
    setReembedding(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/embedding/re-embed/progress`);
        if (!res.ok) return;
        const data: EmbeddingHealth = await res.json();
        setProgress(data);
        if (!hasStale(data)) {
          setReembedding(false);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          toast.success("Re-embedding complete");
          fetchConfig();
        }
      } catch {
        // non-fatal
      }
    }, 5000);
  }, [fetchConfig]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const hasChanges =
    config &&
    (draftProvider !== config.provider ||
      draftModel !== config.model ||
      draftApiKey !== "");

  const handleSaveClick = () => {
    if (!config) return;
    if (draftProvider !== config.provider || draftModel !== config.model) {
      setShowConfirm(true);
    } else if (draftApiKey) {
      doSave();
    }
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError(null);
    setShowConfirm(false);
    try {
      const payload: Record<string, string> = {
        provider: draftProvider,
        model: draftModel,
      };
      if (draftApiKey) {
        payload.api_key = draftApiKey;
      }
      const res = await fetch(`${API}/api/embedding/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        const msg = `Save failed: ${err}`;
        toast.error(msg);
        setSaveError(msg);
        return;
      }
      toast.success("Embedding config saved");
      setSaveError(null);

      if (
        config &&
        (draftProvider !== config.provider || draftModel !== config.model)
      ) {
        const reRes = await fetch(`${API}/api/embedding/re-embed`, {
          method: "POST",
        });
        if (!reRes.ok) {
          const err = await reRes.text();
          toast.error(`Re-embed failed: ${err}`);
          return;
        }
        startPolling();
      }

      setDraftApiKey("");
      await fetchConfig();
    } catch (e) {
      toast.error(`Save error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    if (config) {
      setDraftProvider(config.provider);
      setDraftModel(config.model);
      setDraftApiKey("");
    }
  };

  const handleReembed = async () => {
    try {
      const res = await fetch(`${API}/api/embedding/re-embed`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.text();
        toast.error(`Re-embed failed: ${err}`);
        return;
      }
      startPolling();
    } catch (e) {
      toast.error(`Re-embed error: ${e}`);
    }
  };

  const providerLabel =
    PROVIDERS.find((p) => p.value === draftProvider)?.label ?? draftProvider;
  const totalEntities = config ? healthTotal(config.health) : 0;
  const isStale = config ? hasStale(config.health) : false;

  const progressTotal = progress ? healthTotal(progress) : 0;
  const progressCurrent = progress ? healthCurrent(progress) : 0;
  const progressPct =
    progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  return (
    <div className="border-border/40 border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
          {"\u25B6"}
        </span>
        Embedding Provider
      </button>

      {isOpen && (
        <div className="space-y-3 px-3 pb-3">
          {loading && !config && (
            <div className="space-y-2">
              <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              <div className="bg-muted h-8 w-full animate-pulse rounded" />
              <div className="bg-muted h-8 w-full animate-pulse rounded" />
            </div>
          )}

          {fetchError && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5">
              <p className="text-xs text-red-600 dark:text-red-400">
                {fetchError}
              </p>
            </div>
          )}

          {config && (
            <>
              <p className="text-muted-foreground text-xs">
                Configure the embedding model used for semantic search across
                the knowledge graph.
              </p>

              {/* Stale indicator */}
              {isStale && !reembedding && (
                <div className="flex items-center gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5">
                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    Stale embeddings detected
                  </span>
                  <button
                    onClick={handleReembed}
                    className="rounded bg-yellow-600 px-2 py-0.5 text-xs text-white hover:bg-yellow-700"
                  >
                    Re-embed
                  </button>
                </div>
              )}

              {/* Provider dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">
                  Provider
                </label>
                <select
                  value={draftProvider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setDraftProvider(newProvider);
                    const providerInfo = PROVIDERS.find(
                      (p) => p.value === newProvider,
                    );
                    if (providerInfo) setDraftModel(providerInfo.defaultModel);
                  }}
                  disabled={reembedding || saving}
                  className="bg-background rounded border px-1.5 py-1 text-xs disabled:opacity-50"
                >
                  {PROVIDERS.map((p) => (
                    <option
                      key={p.value}
                      value={p.value}
                    >
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model field */}
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Model</label>
                <input
                  value={draftModel}
                  onChange={(e) => setDraftModel(e.target.value)}
                  disabled={reembedding || saving}
                  className="bg-background rounded border px-1.5 py-1 text-xs disabled:opacity-50"
                  placeholder="e.g. text-embedding-3-small"
                />
              </div>

              {/* API key field */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground text-xs">
                    API Key
                  </label>
                  {config.api_key_set && draftProvider === config.provider && (
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={draftApiKey}
                  onChange={(e) => setDraftApiKey(e.target.value)}
                  disabled={reembedding || saving}
                  className="bg-background rounded border px-1.5 py-1 text-xs disabled:opacity-50"
                  placeholder={
                    config.api_key_set && draftProvider === config.provider
                      ? "Leave blank to keep current"
                      : "Enter API key"
                  }
                />
              </div>

              {/* Current model ID */}
              <div className="text-muted-foreground text-[10px]">
                Current model ID:{" "}
                <code className="bg-muted rounded px-1">{config.model_id}</code>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {saveError}
                  </p>
                </div>
              )}

              {/* Save / Cancel buttons */}
              <div className="flex gap-1">
                <button
                  onClick={handleSaveClick}
                  disabled={!hasChanges || reembedding || saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2 py-0.5 text-xs disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {hasChanges && (
                  <button
                    onClick={handleCancel}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Re-embed progress bar */}
              {reembedding && progress && (
                <div className="space-y-1">
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      Re-embedding: {progressCurrent}/{progressTotal} entities
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Node: {progress.node.current}/{progress.node.total}
                    {" | "}Learning: {progress.learning.current}/
                    {progress.learning.total}
                    {" | "}Skills: {progress.skill_embedding.current}/
                    {progress.skill_embedding.total}
                  </div>
                </div>
              )}

              {/* Confirmation dialog */}
              {showConfirm && (
                <div className="border-border bg-muted/50 space-y-2 rounded border p-3">
                  <p className="text-xs font-medium">
                    Confirm embedding provider change
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Switching to {providerLabel} ({draftModel}) will re-embed{" "}
                    {totalEntities} entities. This runs in the background and
                    does not block operations.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={doSave}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2 py-0.5 text-xs"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={handleCancel}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
