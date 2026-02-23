import { Button } from "@/components/ui/button";
import { MarkdownText } from "./markdown-text";
import { useInterruptApproval, SaisInterruptValue } from "@/hooks/useInterruptApproval";
import { Check, X, MessageSquare } from "lucide-react";

const RPABV_STAGES = [
  { key: "research", letter: "R", label: "Research" },
  { key: "plan", letter: "P", label: "Plan" },
  { key: "approve", letter: "A", label: "Approve" },
  { key: "build", letter: "B", label: "Build" },
  { key: "verify", letter: "V", label: "Verify" },
] as const;

function RPABVStepper({
  progress,
  status,
}: {
  progress: NonNullable<SaisInterruptValue["rpabv_progress"]>;
  status?: string;
}) {
  const currentIdx = RPABV_STAGES.findIndex((s) => s.key === progress.stage);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5">
        {RPABV_STAGES.map((stage, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;

          return (
            <div key={stage.key} className="flex items-center gap-1.5">
              {idx > 0 && (
                <div
                  className={`h-0.5 w-3 ${
                    isCompleted
                      ? "bg-blue-200 dark:bg-blue-700"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
              <div
                title={stage.label}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isCompleted
                      ? "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300"
                      : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                {stage.letter}
              </div>
            </div>
          );
        })}
      </div>
      {status && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {status}
        </p>
      )}
      {progress.step_index !== null && progress.total_steps !== null && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Step {progress.step_index + 1} of {progress.total_steps}
        </p>
      )}
    </div>
  );
}

interface InterruptApprovalProps {
  interruptValue: SaisInterruptValue;
}

/**
 * Shared approval/rejection UI for SAIS interrupt types.
 * Renders the interrupt message (markdown) and approve/reject buttons.
 * Handles both plan_approval and gate_confirmation -- distinguished by type field.
 */
export function InterruptApproval({ interruptValue }: InterruptApprovalProps) {
  const {
    loading,
    feedbackText,
    setFeedbackText,
    showFeedback,
    setShowFeedback,
    handleApprove,
    handleReject,
  } = useInterruptApproval();

  const isPlanApproval = interruptValue.type === "plan_approval";
  const isGateConfirmation = interruptValue.type === "gate_confirmation";

  // Title based on interrupt type and RPABV level
  // RPABVLevel enum is 1-based: DESIGN=1, PLAN=2, EXECUTE=3
  const levelLabels: Record<number, string> = {
    1: "Pipeline Design",
    2: "Implementation Plan",
    3: "Step Execution",
  };
  const rpabvLevel = interruptValue.rpabv_level ?? 1;
  const levelLabel = levelLabels[rpabvLevel] ?? `L${rpabvLevel}`;

  const title = isPlanApproval
    ? `${levelLabel} Review (L${rpabvLevel})`
    : isGateConfirmation
      ? "Action Confirmation"
      : "Pipeline Resumption";

  // Button labels
  const approveLabel = isPlanApproval ? "Approve Plan" : isGateConfirmation ? "Proceed" : "Continue";
  const rejectLabel = isPlanApproval ? "Reject & Revise" : "Cancel";

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {title}
        </h3>
      </div>

      {/* RPABV stage stepper (plan_approval only) */}
      {isPlanApproval && interruptValue.rpabv_progress && (
        <RPABVStepper
          progress={interruptValue.rpabv_progress}
          status={interruptValue.rpabv_status}
        />
      )}

      {/* Render the interrupt message as markdown */}
      <div className="mb-4 rounded-md bg-white/80 p-3 dark:bg-gray-900/50">
        <MarkdownText>{interruptValue.message}</MarkdownText>
      </div>

      {/* Feedback input (shown on reject for plan_approval) */}
      {showFeedback && (
        <div className="mb-3">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe what should change..."
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            rows={3}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleReject(feedbackText)}
              disabled={loading}
            >
              Submit Rejection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowFeedback(false);
                setFeedbackText("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showFeedback && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={loading}
            className="gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          >
            <Check className="h-3.5 w-3.5" />
            {approveLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (isPlanApproval) {
                // Show feedback input for plan rejections
                setShowFeedback(true);
              } else {
                // Direct rejection for gate confirmations
                handleReject();
              }
            }}
            disabled={loading}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            {rejectLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
