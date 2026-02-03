/**
 * ConfirmationDialog - Two-step confirmation dialog for applying fixes.
 *
 * Step 1 ("Review Changes"): Shows full diff view + downstream impact preview.
 *   User can click "Continue to Apply" or "Cancel".
 *
 * Step 2 ("Confirm & Apply"): Warning text with scope information.
 *   User can click "Apply Changes" (final) or "Back".
 *
 * After apply: shows loading state, then success/failure result with Undo button.
 */

"use client";

import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle, Check, Loader2, Undo2 } from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import type { RemediationProposalData } from "./DiffCard";

export interface ConfirmationDialogProps {
  proposal: RemediationProposalData;
  isOpen: boolean;
  onConfirm: (fixId: string) => Promise<{ success: boolean; audit_id?: string }>;
  onCancel: () => void;
}

type Step = "review" | "confirm" | "applying" | "success" | "error";

const SCOPE_LABELS: Record<string, string> = {
  sql: "SQL query",
  dbt: "dbt model",
  metabase: "Metabase card",
};

export function ConfirmationDialog({
  proposal,
  isOpen,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [step, setStep] = useState<Step>("review");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    setStep("applying");
    setError(null);
    try {
      const result = await onConfirm(proposal.fix_id);
      if (result.success) {
        setAuditId(result.audit_id ?? null);
        setStep("success");
      } else {
        setError("Fix application failed. Please try again.");
        setStep("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setStep("error");
    }
  }, [onConfirm, proposal.fix_id]);

  const handleUndo = useCallback(async () => {
    if (!auditId) return;
    try {
      const res = await fetch(`/api/remediation/undo/${auditId}`, {
        method: "POST",
      });
      if (res.ok) {
        onCancel();
      }
    } catch {
      // Undo failed silently -- user can retry
    }
  }, [auditId, onCancel]);

  const handleClose = useCallback(() => {
    setStep("review");
    setAuditId(null);
    setError(null);
    onCancel();
  }, [onCancel]);

  const impactCount = proposal.downstream_impact.length;
  const scopeLabel = SCOPE_LABELS[proposal.scope] || proposal.scope;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl dark:bg-gray-900"
          data-testid="confirmation-dialog"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {step === "review" && "Review Changes"}
              {step === "confirm" && "Confirm & Apply"}
              {step === "applying" && "Applying Changes..."}
              {step === "success" && "Changes Applied"}
              {step === "error" && "Application Failed"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Step 1: Review */}
          {step === "review" && (
            <div>
              <div className="max-h-[60vh] overflow-auto px-6 py-4">
                {/* Proposal title and meta */}
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {proposal.title}
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {proposal.description}
                </p>

                {/* Diff */}
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Changes
                  </h4>
                  <DiffViewer diff={proposal.diff_preview} maxHeight={250} />
                </div>

                {/* Downstream impact */}
                {impactCount > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                      Downstream Impact ({impactCount} item{impactCount !== 1 ? "s" : ""})
                    </h4>
                    <ul className="space-y-1">
                      {proposal.downstream_impact.slice(0, 5).map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-gray-600 dark:text-gray-400"
                        >
                          {item.label || item.node_id} ({item.type}) -{" "}
                          <span className="font-medium">{item.risk_level}</span>
                        </li>
                      ))}
                      {impactCount > 5 && (
                        <li className="text-xs text-gray-500">
                          ...and {impactCount - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                  onClick={() => setStep("confirm")}
                  data-testid="continue-to-apply"
                >
                  Continue to Apply
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === "confirm" && (
            <div>
              <div className="px-6 py-6">
                <div className="flex gap-3 rounded-md bg-amber-50 p-4 dark:bg-amber-950/30">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      This action will modify {scopeLabel} content
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Target: <code className="font-mono">{proposal.target_ref}</code>
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Risk level:{" "}
                      <span className="font-medium uppercase">{proposal.risk_level}</span>
                    </p>
                    {impactCount > 0 && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        This will affect {impactCount} downstream item{impactCount !== 1 ? "s" : ""}.
                      </p>
                    )}
                    <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                      Are you sure you want to apply these changes?
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => setStep("review")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  onClick={handleApply}
                  data-testid="apply-changes-btn"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          )}

          {/* Applying state */}
          {step === "applying" && (
            <div className="flex flex-col items-center justify-center px-6 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Applying changes to {scopeLabel}...
              </p>
            </div>
          )}

          {/* Success state */}
          {step === "success" && (
            <div>
              <div className="flex flex-col items-center justify-center px-6 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  Changes applied successfully
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {proposal.title}
                </p>
              </div>
              <div className="flex justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                {auditId && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={handleUndo}
                    data-testid="undo-btn"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  onClick={handleClose}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {step === "error" && (
            <div>
              <div className="flex flex-col items-center justify-center px-6 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  Application failed
                </p>
                {error && (
                  <p className="mt-1 text-xs text-red-500">{error}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={handleClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => setStep("confirm")}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
