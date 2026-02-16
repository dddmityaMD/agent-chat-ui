"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelPriceRow {
  provider: string;
  model: string;
  input_per_million: number;
  output_per_million: number;
}

interface BudgetConfig {
  monthly_limit_usd: number;
  warning_threshold_pct: number;
}

// ---------------------------------------------------------------------------
// Model Prices Section
// ---------------------------------------------------------------------------

function ModelPricesSection() {
  const [prices, setPrices] = useState<ModelPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/prices`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPrices(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const updateRow = (index: number, field: keyof ModelPriceRow, value: string | number) => {
    setPrices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addRow = () => {
    setPrices((prev) => [
      ...prev,
      { provider: "", model: "", input_per_million: 0, output_per_million: 0 },
    ]);
  };

  const removeRow = (index: number) => {
    setPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const savePrices = async () => {
    // Validate
    const invalid = prices.some((p) => !p.provider.trim() || !p.model.trim());
    if (invalid) {
      toast.error("Provider and Model fields cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prices),
      });
      if (res.ok) {
        const updated = await res.json();
        setPrices(updated);
        toast.success("Model prices saved");
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        toast.error(`Failed to save: ${err.detail || res.statusText}`);
      }
    } catch (e) {
      toast.error("Failed to save model prices");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading prices...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Model Prices</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Model
          </button>
          <button
            onClick={savePrices}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Input $/M</th>
              <th className="px-3 py-2 font-medium">Output $/M</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {prices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  No model prices configured. Click &quot;Add Model&quot; to add one.
                </td>
              </tr>
            )}
            {prices.map((row, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.provider}
                    onChange={(e) => updateRow(i, "provider", e.target.value)}
                    className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="openai"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.model}
                    onChange={(e) => updateRow(i, "model", e.target.value)}
                    className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="gpt-4o-mini"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.input_per_million}
                    onChange={(e) => updateRow(i, "input_per_million", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.output_per_million}
                    onChange={(e) => updateRow(i, "output_per_million", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <button
                    onClick={() => removeRow(i)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Budget Configuration Section
// ---------------------------------------------------------------------------

function BudgetConfigSection() {
  const [config, setConfig] = useState<BudgetConfig>({
    monthly_limit_usd: 50.0,
    warning_threshold_pct: 0.8,
  });
  const [usageSummary, setUsageSummary] = useState<{
    total_cost_usd: number;
    percent_used: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${getApiBaseUrl()}/api/cost/budget/config`, { credentials: "include" }),
      fetch(`${getApiBaseUrl()}/api/cost/budget`, { credentials: "include" }),
    ])
      .then(async ([configRes, budgetRes]) => {
        if (cancelled) return;
        if (configRes.ok) {
          const c = await configRes.json();
          setConfig(c);
        }
        if (budgetRes.ok) {
          const b = await budgetRes.json();
          setUsageSummary({
            total_cost_usd: b.total_cost_usd,
            percent_used: b.percent_used,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/budget/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        toast.success("Budget configuration saved");
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        toast.error(`Failed to save: ${err.detail || res.statusText}`);
      }
    } catch {
      toast.error("Failed to save budget configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading budget config...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Budget Configuration</h2>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {usageSummary && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            Current month usage:{" "}
            <span className="font-medium text-foreground">
              ${usageSummary.total_cost_usd.toFixed(2)}
            </span>{" "}
            ({Math.round(usageSummary.percent_used * 100)}% of limit)
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Monthly Limit (USD)
          </label>
          <input
            type="number"
            step="1"
            min="1"
            value={config.monthly_limit_usd}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                monthly_limit_usd: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Warning Threshold (%)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={Math.round(config.warning_threshold_pct * 100)}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                warning_threshold_pct: (parseFloat(e.target.value) || 0) / 100,
              }))
            }
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            A warning toast will appear when usage reaches this percentage.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost Management Page
// ---------------------------------------------------------------------------

export default function CostSettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Cost Management</h1>
      <ModelPricesSection />
      <hr className="border-border/40" />
      <BudgetConfigSection />
    </div>
  );
}
