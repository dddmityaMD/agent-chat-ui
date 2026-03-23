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
          <div className="border-muted-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
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
        <div className="border-muted-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-lg font-semibold">Plugins</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage loaded connector plugins
          </p>
        </div>
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Failed to load plugin data
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{fetchError}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!pluginData || pluginData.plugins.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-lg font-semibold">Plugins</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage loaded connector plugins
          </p>
        </div>
        <div className="border-border/60 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">No plugins loaded.</p>
          <p className="text-muted-foreground mt-1 text-xs">
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
        <h1 className="text-foreground text-lg font-semibold">Plugins</h1>
        <p className="text-muted-foreground mt-1 text-sm">
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
            className="border-border/60 bg-card rounded-lg border p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Name + version */}
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {plugin.name}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                    v{plugin.version}
                  </span>
                </div>

                {/* Description */}
                {plugin.description && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {plugin.description}
                  </p>
                )}

                {/* Metadata row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                    {plugin.connector_type}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                    {plugin.tier}
                  </span>
                  {plugin.author && (
                    <span className="text-muted-foreground text-[10px]">
                      by {plugin.author}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0">
                {plugin.status === "loaded" ? (
                  <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    Loaded
                  </span>
                ) : (
                  <span className="bg-destructive/10 text-destructive inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    Error
                  </span>
                )}
              </div>
            </div>

            {/* Error details (expandable) */}
            {plugin.status === "error" && plugin.error_message && (
              <div className="border-border/40 mt-3 border-t pt-2">
                <button
                  onClick={() => toggleError(plugin.name)}
                  className="text-destructive text-xs hover:underline"
                >
                  {expandedErrors.has(plugin.name)
                    ? "Hide error details"
                    : "Show error details"}
                </button>
                {expandedErrors.has(plugin.name) && (
                  <pre className="bg-destructive/5 text-destructive mt-2 overflow-x-auto rounded p-2 text-xs">
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
