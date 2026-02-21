"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { useAuth } from "@/providers/Auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_seen: string | null;
}

interface SessionRow {
  session_id: string;
  device_info: string | null;
  last_seen: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function providerIcon(provider: string): React.ReactNode {
  if (provider === "google") {
    return (
      <span
        title="Google"
        className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
      >
        G
      </span>
    );
  }
  if (provider === "github") {
    return (
      <span
        title="GitHub"
        className="inline-flex items-center rounded bg-zinc-500/10 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300"
      >
        GH
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {provider}
    </span>
  );
}

function roleBadge(role: string): React.ReactNode {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Member
    </span>
  );
}

function statusBadge(isActive: boolean): React.ReactNode {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Inactive
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserManagementPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (currentUser && !isAdmin) {
      router.push("/settings/connectors");
    }
  }, [currentUser, isAdmin, router]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  // Fetch sessions for a user
  const fetchSessions = useCallback(async (userId: string) => {
    const base = getApiBaseUrl();
    setSessionsLoading(true);
    try {
      const res = await fetch(`${base}/api/users/${userId}/sessions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Failed to load sessions");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const toggleExpand = useCallback(
    (userId: string) => {
      if (expandedUser === userId) {
        setExpandedUser(null);
        setSessions([]);
      } else {
        setExpandedUser(userId);
        fetchSessions(userId);
      }
    },
    [expandedUser, fetchSessions],
  );

  // Role toggle
  const toggleRole = useCallback(
    async (userId: string, currentRole: string) => {
      const newRole = currentRole === "admin" ? "member" : "admin";
      setActionInProgress(userId);
      const base = getApiBaseUrl();
      try {
        const res = await fetch(`${base}/api/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: newRole }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail ?? "Failed to update role");
        }
        toast.success(`User role changed to ${newRole}`);
        await fetchUsers();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update role";
        toast.error(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchUsers],
  );

  // Status toggle
  const toggleStatus = useCallback(
    async (userId: string, currentlyActive: boolean) => {
      setActionInProgress(userId);
      const base = getApiBaseUrl();
      try {
        const res = await fetch(`${base}/api/users/${userId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active: !currentlyActive }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail ?? "Failed to update status");
        }
        toast.success(
          currentlyActive ? "User deactivated" : "User activated",
        );
        await fetchUsers();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update status";
        toast.error(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchUsers],
  );

  // While loading or if not admin, show nothing
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          User Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage team members, roles, and account status.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted/20 py-12">
          <Users className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No other users yet. Share the login URL to invite team members.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  User
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Provider
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Last Seen
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.user_id;
                const isExpanded = expandedUser === u.user_id;
                const isActioning = actionInProgress === u.user_id;

                return (
                  <React.Fragment key={u.user_id}>
                    <tr
                      className={`border-b border-border/20 transition-colors hover:bg-muted/20 ${!u.is_active ? "opacity-60" : ""}`}
                    >
                      {/* User info */}
                      <td className="px-4 py-3">
                        <button
                          className="flex items-center gap-2 text-left"
                          onClick={() => toggleExpand(u.user_id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium text-foreground">
                              {u.name ?? u.email}
                            </div>
                            {u.name && (
                              <div className="text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3">{providerIcon(u.provider)}</td>

                      {/* Role */}
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {statusBadge(u.is_active)}
                      </td>

                      {/* Last Seen */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {relativeTime(u.last_seen)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSelf ? (
                            <span
                              className="text-xs text-muted-foreground/60"
                              title="Cannot modify your own account"
                            >
                              (you)
                            </span>
                          ) : (
                            <>
                              <button
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-50"
                                onClick={() => toggleRole(u.user_id, u.role)}
                                disabled={isActioning}
                                title={
                                  u.role === "admin"
                                    ? "Demote to member"
                                    : "Promote to admin"
                                }
                              >
                                {u.role === "admin" ? (
                                  <>
                                    <ShieldOff className="h-3.5 w-3.5" />
                                    Make Member
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-3.5 w-3.5" />
                                    Make Admin
                                  </>
                                )}
                              </button>
                              <button
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                                  u.is_active
                                    ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                                    : "text-green-600 hover:bg-green-500/10 dark:text-green-400"
                                }`}
                                onClick={() =>
                                  toggleStatus(u.user_id, u.is_active)
                                }
                                disabled={isActioning}
                                title={
                                  u.is_active ? "Deactivate user" : "Activate user"
                                }
                              >
                                {u.is_active ? (
                                  <>
                                    <UserX className="h-3.5 w-3.5" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Activate
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row: sessions */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={6}
                          className="border-b border-border/20 bg-muted/10 px-8 py-3"
                        >
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Active Sessions
                          </div>
                          {sessionsLoading ? (
                            <div className="text-xs text-muted-foreground py-2">
                              Loading sessions...
                            </div>
                          ) : sessions.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2">
                              No active sessions.
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="pb-1 text-left font-medium">
                                    Device
                                  </th>
                                  <th className="pb-1 text-left font-medium">
                                    Last Seen
                                  </th>
                                  <th className="pb-1 text-left font-medium">
                                    Created
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessions.map((s) => (
                                  <tr
                                    key={s.session_id}
                                    className="text-muted-foreground"
                                  >
                                    <td className="py-1">
                                      {s.device_info ?? "Unknown device"}
                                    </td>
                                    <td className="py-1">
                                      {relativeTime(s.last_seen)}
                                    </td>
                                    <td className="py-1">
                                      {relativeTime(s.created_at)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
