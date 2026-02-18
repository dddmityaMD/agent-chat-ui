"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { useAuth } from "@/providers/Auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginEntry {
  name: string;
  version: string;
  status: "loaded" | "error";
  connector_type: string;
  tier: string;
  description: string;
  author: string;
  error_message: string | null;
}

interface PluginListResponse {
  plugins: PluginEntry[];
  has_errors: boolean;
  total: number;
  loaded: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PluginsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      }
    >
      <PluginsPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function PluginsPageContent() {
  const { setSessionExpired } = useAuth();
  const [pluginData, setPluginData] = useState<PluginListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/plugins`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          setSessionExpired(true);
          return null;
        }
        if (!r.ok) {
          throw new Error(`Server returned ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data) setPluginData(data);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err?.message || "Failed to load plugins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setSessionExpired]);

  const toggleError = useCallback((name: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Plugins</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage loaded connector plugins
          </p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Failed to load plugin data
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{fetchError}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!pluginData || pluginData.plugins.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Plugins</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage loaded connector plugins
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-16 text-center">
          <p className="text-sm text-muted-foreground">No plugins loaded.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Place plugin directories with plugin.yaml in the built-in plugins/
            directory or set SAIS_PLUGIN_DIRS environment variable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Plugins</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pluginData.loaded} plugin{pluginData.loaded !== 1 ? "s" : ""} loaded
          {pluginData.errors > 0 && (
            <span className="text-destructive">
              , {pluginData.errors} error{pluginData.errors !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      {/* Plugin cards */}
      <div className="space-y-3">
        {pluginData.plugins.map((plugin) => (
          <div
            key={plugin.name}
            className="rounded-lg border border-border/60 bg-card p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Name + version */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {plugin.name}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    v{plugin.version}
                  </span>
                </div>

                {/* Description */}
                {plugin.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plugin.description}
                  </p>
                )}

                {/* Metadata row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {plugin.connector_type}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {plugin.tier}
                  </span>
                  {plugin.author && (
                    <span className="text-[10px] text-muted-foreground">
                      by {plugin.author}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0">
                {plugin.status === "loaded" ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Loaded
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    Error
                  </span>
                )}
              </div>
            </div>

            {/* Error details (expandable) */}
            {plugin.status === "error" && plugin.error_message && (
              <div className="mt-3 border-t border-border/40 pt-2">
                <button
                  onClick={() => toggleError(plugin.name)}
                  className="text-xs text-destructive hover:underline"
                >
                  {expandedErrors.has(plugin.name)
                    ? "Hide error details"
                    : "Show error details"}
                </button>
                {expandedErrors.has(plugin.name) && (
                  <pre className="mt-2 overflow-x-auto rounded bg-destructive/5 p-2 text-xs text-destructive">
                    {plugin.error_message}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
