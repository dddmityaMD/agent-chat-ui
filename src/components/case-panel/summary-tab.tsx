"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { ReadinessPanel } from "@/components/readiness/ReadinessPanel";
import { ContextPanelSection } from "@/components/context-panel";
import { toast } from "sonner";
import type { ThreadSummary } from "@/components/case-panel";
import type { PermissionState } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SummaryTabProps {
  threadId: string | null;
  summary: ThreadSummary | null;
  loading: boolean;
  error: string | null;
  permissionState: PermissionState;
  revokePermissionGrant: (pendingActionId: string | null) => void;
  stream: {
    messages: any[];
    submit: (input: any, options: any) => void;
  };
}

// ---------------------------------------------------------------------------
// SummaryTab
// ---------------------------------------------------------------------------

export function SummaryTab({
  threadId,
  summary,
  loading,
  error,
  permissionState,
  revokePermissionGrant,
  stream,
}: SummaryTabProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyThreadId = useCallback(() => {
    if (!threadId) return;
    navigator.clipboard.writeText(threadId).then(() => {
      setCopyFeedback(true);
      toast.success("Thread ID copied");
      setTimeout(() => setCopyFeedback(false), 1500);
    }).catch(() => {
      toast.error("Failed to copy");
    });
  }, [threadId]);

  return (
    <div className="grid gap-4">
      {/* Thread header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Thread</span>
            {summary?.thread.is_archived && (
              <span
                className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                data-testid="thread-archived-badge"
              >
                Archived
              </span>
            )}
          </div>
          {threadId ? (
            <div className="flex items-center gap-1 text-muted-foreground text-xs" data-testid="thread-id-display">
              <span className="font-mono select-all">{threadId}</span>
              <button
                type="button"
                onClick={handleCopyThreadId}
                className="text-muted-foreground hover:text-foreground"
                title="Copy thread ID"
                data-testid="copy-thread-id"
              >
                <Copy className={cn("h-3 w-3", copyFeedback && "text-green-600")} />
              </button>
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">(no thread selected)</div>
          )}
        </div>
        {loading && (
          <div className="text-muted-foreground text-xs">Loading...</div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Readiness Section */}
          <div>
            <ReadinessPanel
              showParallelExecution={true}
              enabled={!!summary}
              className="border-0 shadow-none"
            />
          </div>

          {/* Agent Context Section */}
          <ContextPanelSection threadId={threadId} />

          {/* Permissions (collapsed by default) */}
          <details
            id="permissions-section"
            className="grid gap-2"
            data-testid="permissions-section"
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Permissions
            </summary>
            <div className="rounded-md border bg-card p-3">
              {permissionState.grants.length === 0 ? (
                <div className="text-muted-foreground text-sm">No active grants</div>
              ) : (
                <div className="space-y-2">
                  {permissionState.grants.map((grant) => (
                    <div
                      key={`${grant.pending_action_id ?? "grant"}-${grant.granted_at}`}
                      className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-amber-900">
                            {grant.capability.toUpperCase()} ({grant.scope})
                          </div>
                          <div className="text-xs text-amber-800">
                            Granted: {new Date(grant.granted_at).toLocaleString()}
                          </div>
                          {grant.expires_at && (
                            <div className="text-xs text-amber-800">
                              Expires: {new Date(grant.expires_at).toLocaleString()}
                            </div>
                          )}
                          {grant.reason && (
                            <div className="mt-1 text-xs text-amber-800">Reason: {grant.reason}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded border border-amber-300 bg-card px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          onClick={() => {
                            revokePermissionGrant(grant.pending_action_id);
                            const text = `deny write${grant.pending_action_id ? ` pending_action_id=${grant.pending_action_id}` : ""}`;
                            stream.submit(
                              {
                                messages: [
                                  ...stream.messages,
                                  {
                                    id: uuidv4(),
                                    type: "human",
                                    content: [{ type: "text", text }],
                                  },
                                ],
                              } as Record<string, unknown> as any,
                              {
                                streamMode: ["values"],
                                streamSubgraphs: true,
                                streamResumable: true,
                              },
                            );
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

        </>
      )}
    </div>
  );
}
