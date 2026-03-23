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
    <span className="bg-muted text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium">
      {provider}
    </span>
  );
}

function roleBadge(role: string): React.ReactNode {
  if (role === "admin") {
    return (
      <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
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
        toast.success(currentlyActive ? "User deactivated" : "User activated");
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
        <h1 className="text-foreground text-lg font-semibold">
          User Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage team members, roles, and account status.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="border-border/40 bg-muted/20 flex flex-col items-center justify-center gap-2 rounded-lg border py-12">
          <Users className="text-muted-foreground/50 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            No other users yet. Share the login URL to invite team members.
          </p>
        </div>
      ) : (
        <div className="border-border/40 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border/40 bg-muted/30 border-b">
                <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                  User
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                  Provider
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                  Role
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                  Status
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                  Last Seen
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-right font-medium">
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
                      className={`border-border/20 hover:bg-muted/20 border-b transition-colors ${!u.is_active ? "opacity-60" : ""}`}
                    >
                      {/* User info */}
                      <td className="px-4 py-3">
                        <button
                          className="flex items-center gap-2 text-left"
                          onClick={() => toggleExpand(u.user_id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                          )}
                          <div>
                            <div className="text-foreground font-medium">
                              {u.name ?? u.email}
                            </div>
                            {u.name && (
                              <div className="text-muted-foreground text-xs">
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
                      <td className="px-4 py-3">{statusBadge(u.is_active)}</td>

                      {/* Last Seen */}
                      <td className="text-muted-foreground px-4 py-3">
                        {relativeTime(u.last_seen)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSelf ? (
                            <span
                              className="text-muted-foreground/60 text-xs"
                              title="Cannot modify your own account"
                            >
                              (you)
                            </span>
                          ) : (
                            <>
                              <button
                                className="hover:bg-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
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
                                  u.is_active
                                    ? "Deactivate user"
                                    : "Activate user"
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
                          className="border-border/20 bg-muted/10 border-b px-8 py-3"
                        >
                          <div className="text-muted-foreground mb-2 text-xs font-medium">
                            Active Sessions
                          </div>
                          {sessionsLoading ? (
                            <div className="text-muted-foreground py-2 text-xs">
                              Loading sessions...
                            </div>
                          ) : sessions.length === 0 ? (
                            <div className="text-muted-foreground py-2 text-xs">
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
