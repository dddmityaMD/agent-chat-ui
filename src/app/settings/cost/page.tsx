"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { useAuth } from "@/providers/Auth";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";

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

interface UserCostRow {
  user_id: string;
  email: string;
  name: string | null;
  total_cost_usd: number;
  model_breakdown: { model: string; cost: number }[];
  budget_limit: number | null;
  status: "ok" | "warning";
}

interface UserModelRow {
  model: string;
  total_cost_usd: number;
  request_count: number;
}

interface UserBudgetData {
  user_id: string;
  monthly_limit_usd: number;
  warning_threshold: number;
}

interface PersonalBudget {
  user_id: string;
  used_usd: number;
  monthly_limit_usd: number;
  remaining_usd: number;
  percent_used: number;
  warning_active: boolean;
  period_start: string;
  period_end: string;
}

// ---------------------------------------------------------------------------
// Hook: detect admin role from /api/me or cookie
// ---------------------------------------------------------------------------

function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { setSessionExpired } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/users/me`, {
          credentials: "include",
        });
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setIsAdmin(data.role === "admin");
        }
      } catch {
        // Fallback: treat as non-admin
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSessionExpired]);

  return { isAdmin, loading };
}

// ---------------------------------------------------------------------------
// Member Budget View (simple monthly total)
// ---------------------------------------------------------------------------

function MemberBudgetView() {
  const [budget, setBudget] = useState<PersonalBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const { setSessionExpired } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/cost/budget`, {
          credentials: "include",
        });
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setBudget(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSessionExpired]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading usage...</p>;
  }

  if (!budget) {
    return (
      <p className="text-muted-foreground text-sm">
        Unable to load usage data.
      </p>
    );
  }

  const pctInt = Math.round(budget.percent_used * 100);

  return (
    <div className="space-y-4">
      {budget.warning_active && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            You&apos;ve used {pctInt}% of your monthly budget ($
            {budget.used_usd.toFixed(2)} / $
            {budget.monthly_limit_usd.toFixed(2)})
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Approaching budget limit
          </p>
        </div>
      )}

      <div className="bg-card rounded-md border p-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <DollarSign className="text-muted-foreground h-5 w-5" />
          <h2 className="text-foreground text-lg font-semibold">
            Your Monthly Usage
          </h2>
        </div>
        <p className="text-foreground text-3xl font-bold tabular-nums">
          ${budget.used_usd.toFixed(2)}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          of ${budget.monthly_limit_usd.toFixed(2)} limit
        </p>

        {/* Progress bar */}
        <div className="bg-muted mt-4 h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full transition-all ${
              budget.warning_active ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(pctInt, 100)}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {pctInt}% used this month
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin: Per-User Cost Table
// ---------------------------------------------------------------------------

function AdminUserCostTable() {
  const [users, setUsers] = useState<UserCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserModelRow[] | null>(null);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({ limit: 50, threshold: 80 });
  const { setSessionExpired } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/users`, {
        credentials: "include",
      });
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [setSessionExpired]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserDetail(null);
      return;
    }
    setExpandedUser(userId);
    setUserDetail(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/users/${userId}`, {
        credentials: "include",
      });
      if (res.ok) {
        setUserDetail(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const saveBudget = async (userId: string) => {
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/cost/users/${userId}/budget`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            monthly_limit_usd: budgetForm.limit,
            warning_threshold: budgetForm.threshold / 100,
          }),
        },
      );
      if (res.ok) {
        toast.success("Budget saved");
        setEditingBudget(null);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        toast.error(`Failed: ${err.detail || res.statusText}`);
      }
    } catch {
      toast.error("Failed to save budget");
    }
  };

  const startEditBudget = (user: UserCostRow) => {
    setEditingBudget(user.user_id);
    setBudgetForm({
      limit: user.budget_limit ?? 50,
      threshold: 80,
    });
  };

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading user costs...</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="text-muted-foreground h-4 w-4" />
        <h2 className="text-foreground text-lg font-semibold">
          Per-User Cost Breakdown
        </h2>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No user cost data available.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b text-left">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">This Month</th>
                <th className="px-3 py-2 font-medium">Budget Limit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <React.Fragment key={user.user_id}>
                  <tr
                    className="hover:bg-muted/30 cursor-pointer border-b transition-colors last:border-b-0"
                    onClick={() => toggleUser(user.user_id)}
                  >
                    <td className="px-3 py-2">
                      {expandedUser === user.user_id ? (
                        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <span className="text-foreground font-medium">
                          {user.name || user.email}
                        </span>
                        {user.name && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {user.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      ${user.total_cost_usd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {user.budget_limit != null
                        ? `$${user.budget_limit.toFixed(2)}`
                        : "Default"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === "warning"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                            : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                        }`}
                      >
                        {user.status === "warning" ? "Warning" : "OK"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditBudget(user);
                        }}
                        className="text-muted-foreground hover:bg-accent rounded p-1 transition-colors"
                        title="Edit budget"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* Budget editor row */}
                  {editingBudget === user.user_id && (
                    <tr className="bg-muted/20 border-b">
                      <td
                        colSpan={6}
                        className="px-6 py-3"
                      >
                        <div className="flex items-end gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">
                              Monthly Limit ($)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={budgetForm.limit}
                              onChange={(e) =>
                                setBudgetForm((f) => ({
                                  ...f,
                                  limit: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="bg-background w-28 rounded border px-2 py-1 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">
                              Warning at (%)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={budgetForm.threshold}
                              onChange={(e) =>
                                setBudgetForm((f) => ({
                                  ...f,
                                  threshold: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="bg-background w-20 rounded border px-2 py-1 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveBudget(user.user_id);
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1 text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBudget(null);
                            }}
                            className="hover:bg-accent rounded border px-3 py-1 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Expanded detail row */}
                  {expandedUser === user.user_id && (
                    <tr className="bg-muted/10 border-b">
                      <td
                        colSpan={6}
                        className="px-6 py-3"
                      >
                        {userDetail === null ? (
                          <p className="text-muted-foreground text-xs">
                            Loading...
                          </p>
                        ) : userDetail.length === 0 ? (
                          <p className="text-muted-foreground text-xs">
                            No model data.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground text-left">
                                <th className="pb-1 font-medium">Model</th>
                                <th className="pb-1 font-medium">Cost</th>
                                <th className="pb-1 font-medium">Requests</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userDetail.map((m) => (
                                <tr key={m.model}>
                                  <td className="py-0.5">{m.model}</td>
                                  <td className="py-0.5 tabular-nums">
                                    ${m.total_cost_usd.toFixed(4)}
                                  </td>
                                  <td className="py-0.5 tabular-nums">
                                    {m.request_count}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model Prices Section
// ---------------------------------------------------------------------------

function ModelPricesSection() {
  const [prices, setPrices] = useState<ModelPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setSessionExpired } = useAuth();

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/cost/prices`, {
        credentials: "include",
      });
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPrices(data);
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, [setSessionExpired]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const updateRow = (
    index: number,
    field: keyof ModelPriceRow,
    value: string | number,
  ) => {
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
    return <p className="text-muted-foreground text-sm">Loading prices...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Model Prices</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="hover:bg-accent inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Model
          </button>
          <button
            onClick={savePrices}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground border-b text-left">
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Input $/M</th>
              <th className="px-3 py-2 font-medium">Output $/M</th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-3 py-4 text-center"
                >
                  No model prices configured. Click &quot;Add Model&quot; to add
                  one.
                </td>
              </tr>
            )}
            {prices.map((row, i) => (
              <tr
                key={i}
                className="border-b last:border-b-0"
              >
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.provider}
                    onChange={(e) => updateRow(i, "provider", e.target.value)}
                    className="bg-background focus:ring-primary w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                    placeholder="openai"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.model}
                    onChange={(e) => updateRow(i, "model", e.target.value)}
                    className="bg-background focus:ring-primary w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                    placeholder="gpt-4o-mini"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.input_per_million}
                    onChange={(e) =>
                      updateRow(
                        i,
                        "input_per_million",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="bg-background focus:ring-primary w-24 rounded border px-2 py-1 text-sm tabular-nums outline-none focus:ring-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.output_per_million}
                    onChange={(e) =>
                      updateRow(
                        i,
                        "output_per_million",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="bg-background focus:ring-primary w-24 rounded border px-2 py-1 text-sm tabular-nums outline-none focus:ring-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors"
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
    used_usd: number;
    percent_used: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setSessionExpired } = useAuth();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${getApiBaseUrl()}/api/cost/budget/config`, {
        credentials: "include",
      }),
      fetch(`${getApiBaseUrl()}/api/cost/budget`, { credentials: "include" }),
    ])
      .then(async ([configRes, budgetRes]) => {
        if (cancelled) return;
        if (configRes.status === 401 || budgetRes.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (configRes.ok) {
          const c = await configRes.json();
          setConfig(c);
        }
        if (budgetRes.ok) {
          const b = await budgetRes.json();
          setUsageSummary({
            used_usd: b.used_usd,
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
  }, [setSessionExpired]);

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
    return (
      <p className="text-muted-foreground text-sm">Loading budget config...</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">
          Budget Configuration
        </h2>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {usageSummary && (
        <div className="bg-muted/30 rounded-md border p-3">
          <p className="text-muted-foreground text-sm">
            Current month usage:{" "}
            <span className="text-foreground font-medium">
              ${usageSummary.used_usd.toFixed(2)}
            </span>{" "}
            ({Math.round(usageSummary.percent_used * 100)}% of limit)
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-medium">
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
            className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-medium">
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
            className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
          />
          <p className="text-muted-foreground text-xs">
            A warning toast will appear when usage reaches this percentage.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost Management Page (role-aware)
// ---------------------------------------------------------------------------

export default function CostSettingsPage() {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-foreground text-xl font-semibold">
          Cost Management
        </h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  // Member view: simple monthly total
  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <h1 className="text-foreground text-xl font-semibold">
          Cost Management
        </h1>
        <MemberBudgetView />
      </div>
    );
  }

  // Admin view: full management
  return (
    <div className="space-y-8">
      <h1 className="text-foreground text-xl font-semibold">Cost Management</h1>
      <AdminUserCostTable />
      <hr className="border-border/40" />
      <ModelPricesSection />
      <hr className="border-border/40" />
      <BudgetConfigSection />
    </div>
  );
}
