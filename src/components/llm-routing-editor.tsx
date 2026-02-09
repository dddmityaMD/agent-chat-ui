"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface RoutingConfig {
  operation_type: string;
  provider: string;
  model: string;
  temperature: number;
  is_default: boolean;
}

import { getApiBaseUrl } from "@/lib/api-url";

const CASES_API = getApiBaseUrl();

export function LLMRoutingEditor() {
  const [configs, setConfigs] = useState<RoutingConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<RoutingConfig>>({});

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch(`${CASES_API}/api/llm/config`);
      if (!res.ok) return;
      const data = await res.json();
      // Parse API response: data.routing is a dict keyed by operation type
      // Each value has { primary: { provider, model, temperature }, fallback: ... }
      if (data.routing && typeof data.routing === "object") {
        const parsed: RoutingConfig[] = Object.entries(data.routing).map(
          ([opType, route]: [string, unknown]) => {
            const r = route as Record<string, unknown> | null;
            const primary = (r?.primary as Record<string, unknown>) || {};
            return {
              operation_type: opType,
              provider: (primary.provider as string) || (data.provider as string) || "",
              model: (primary.model as string) || "",
              temperature: (primary.temperature as number) ?? 0,
              is_default: !r?.error,
            };
          }
        );
        setConfigs(parsed);
      } else if (Array.isArray(data)) {
        // Backward compatibility if API ever returns flat array
        setConfigs(data);
      } else {
        setConfigs([]);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchConfigs();
  }, [isOpen, fetchConfigs]);

  const handleSave = async (opType: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${CASES_API}/api/llm/config/${opType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const err = await res.text();
        toast.error(`Save failed: ${err}`);
        return;
      }
      toast.success(`Saved ${opType} config`);
      setEditingIdx(null);
      setDraft({});
      await fetchConfigs();
    } catch (e) {
      toast.error(`Save error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (opType: string) => {
    try {
      const res = await fetch(`${CASES_API}/api/llm/config/${opType}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Reset ${opType} to default`);
        await fetchConfigs();
      }
    } catch {
      // non-fatal
    }
  };

  const startEdit = (idx: number, config: RoutingConfig) => {
    setEditingIdx(idx);
    setDraft({
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
    });
  };

  return (
    <div className="border-t border-border/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
          {"\u25B6"}
        </span>
        LLM Routing
      </button>

      {isOpen && (
        <div className="px-3 pb-2 space-y-2">
          {configs.length === 0 && (
            <p className="text-xs text-muted-foreground">No routing configs loaded.</p>
          )}
          {configs.map((cfg, idx) => (
            <div
              key={cfg.operation_type}
              className="flex flex-col gap-1 rounded border border-border/50 p-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{cfg.operation_type}</span>
                <div className="flex gap-1">
                  {editingIdx !== idx && (
                    <button
                      onClick={() => startEdit(idx, cfg)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  )}
                  {!cfg.is_default && (
                    <button
                      onClick={() => handleReset(cfg.operation_type)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {editingIdx === idx ? (
                <div className="flex flex-col gap-1">
                  <input
                    className="rounded border px-1.5 py-0.5 text-xs bg-background"
                    value={draft.provider || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, provider: e.target.value })
                    }
                    placeholder="provider"
                  />
                  <input
                    className="rounded border px-1.5 py-0.5 text-xs bg-background"
                    value={draft.model || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, model: e.target.value })
                    }
                    placeholder="model"
                  />
                  <input
                    className="rounded border px-1.5 py-0.5 text-xs bg-background"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={draft.temperature ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        temperature: parseFloat(e.target.value),
                      })
                    }
                    placeholder="temperature"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => handleSave(cfg.operation_type)}
                      disabled={loading}
                      className="rounded bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingIdx(null);
                        setDraft({});
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {cfg.provider}/{cfg.model} (temp: {cfg.temperature})
                  {cfg.is_default && " [default]"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
