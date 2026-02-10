/**
 * BatchReview - Review all proposals in a batch with batch-level actions.
 *
 * Shows a list of DiffCards, header with count and batch actions
 * (Approve All / Reject All), and a summary bar showing current status.
 * Each approval triggers the two-step ConfirmationDialog flow.
 */

"use client";

import { useState, useCallback } from "react";
import { Check, X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { DiffCard, type RemediationProposalData } from "./DiffCard";
import { ConfirmationDialog } from "./ConfirmationDialog";

export interface BatchReviewProps {
  /** Batch ID for API calls */
  batchId: string;
  /** Thread ID for context */
  threadId: string;
  /** List of proposals in this batch */
  proposals: RemediationProposalData[];
  /** Base URL for the remediation API (default: "") */
  apiBaseUrl?: string;
}

type FixStatus = "pending" | "approved" | "rejected";

export function BatchReview({
  batchId,
  threadId,
  proposals,
  apiBaseUrl = "",
}: BatchReviewProps) {
  const [statuses, setStatuses] = useState<Record<string, FixStatus>>(() => {
    const initial: Record<string, FixStatus> = {};
    for (const p of proposals) {
      initial[p.fix_id] = "pending";
    }
    return initial;
  });

  const [confirmingFixId, setConfirmingFixId] = useState<string | null>(null);
  const confirmingProposal = proposals.find((p) => p.fix_id === confirmingFixId);

  // Counts
  const approvedCount = Object.values(statuses).filter((s) => s === "approved").length;
  const rejectedCount = Object.values(statuses).filter((s) => s === "rejected").length;
  const pendingCount = Object.values(statuses).filter((s) => s === "pending").length;

  // Apply a fix via the API
  const handleConfirm = useCallback(
    async (fixId: string): Promise<{ success: boolean; audit_id?: string }> => {
      const res = await fetch(`${apiBaseUrl}/api/remediation/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fix_id: fixId,
          batch_id: batchId,
          confirmed: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Apply failed (${res.status})`);
      }

      const data = await res.json();

      setStatuses((prev) => ({ ...prev, [fixId]: "approved" }));
      setConfirmingFixId(null);

      return { success: data.success ?? true, audit_id: data.audit_id };
    },
    [apiBaseUrl, batchId],
  );

  // Reject a fix via the API
  const handleReject = useCallback(
    async (fixId: string) => {
      try {
        await fetch(`${apiBaseUrl}/api/remediation/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fix_id: fixId,
            batch_id: batchId,
            reason: null,
          }),
        });
      } catch {
        // Record locally even if API call fails
      }
      setStatuses((prev) => ({ ...prev, [fixId]: "rejected" }));
    },
    [apiBaseUrl, batchId],
  );

  // Approve triggers the confirmation dialog
  const handleApprove = useCallback((fixId: string) => {
    setConfirmingFixId(fixId);
  }, []);

  // Batch actions
  const handleApproveAll = useCallback(() => {
    // Approve all pending items one by one (each opens confirmation dialog)
    const firstPending = proposals.find((p) => statuses[p.fix_id] === "pending");
    if (firstPending) {
      setConfirmingFixId(firstPending.fix_id);
    }
  }, [proposals, statuses]);

  const handleRejectAll = useCallback(() => {
    for (const p of proposals) {
      if (statuses[p.fix_id] === "pending") {
        handleReject(p.fix_id);
      }
    }
  }, [proposals, statuses, handleReject]);

  if (proposals.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
        data-testid="batch-review-empty"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No remediation proposals generated for this case.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="batch-review">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Proposed Changes ({proposals.length})
        </h2>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleRejectAll}
              data-testid="reject-all-btn"
            >
              <X className="h-3 w-3" />
              Reject All
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              onClick={handleApproveAll}
              data-testid="approve-all-btn"
            >
              <Check className="h-3 w-3" />
              Approve All
            </button>
          </div>
        )}
      </div>

      {/* Proposal cards */}
      <div className="space-y-3">
        {proposals.map((proposal) => (
          <DiffCard
            key={proposal.fix_id}
            proposal={proposal}
            onApprove={handleApprove}
            onReject={handleReject}
            status={statuses[proposal.fix_id]}
          />
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs dark:bg-gray-800">
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {approvedCount} approved
        </span>
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          {rejectedCount} rejected
        </span>
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {pendingCount} pending
        </span>
      </div>

      {/* Confirmation dialog */}
      {confirmingProposal && (
        <ConfirmationDialog
          proposal={confirmingProposal}
          isOpen={!!confirmingFixId}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmingFixId(null)}
        />
      )}
    </div>
  );
}
