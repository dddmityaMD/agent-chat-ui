import { Button } from "@/components/ui/button";
import { MarkdownText } from "./markdown-text";
import { useInterruptApproval, SaisInterruptValue, SaisInterruptArtifact } from "@/hooks/useInterruptApproval";
import { Check, X, MessageSquare, Database, FileCode, CheckCircle, Info, CheckCircle2, XCircle } from "lucide-react";

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

/** Format a single artifact item for display */
function formatArtifactItem(item: unknown): string {
  if (typeof item === "string") {
    // Strip Python enum prefixes like "VerificationStatus.VERIFIED_FIXED"
    const enumMatch =
      typeof item === "string" && item.match(/^[A-Za-z]+\.([A-Z_]+)$/);
    if (enumMatch) {
      return enumMatch[1].replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    }
    return item;
  }
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    // dbt model objects: show name + type
    if (obj.name) {
      const parts = [String(obj.name)];
      if (obj.type) parts.push(`(${obj.type})`);
      if (obj.path) parts.push(`— ${obj.path}`);
      return parts.join(" ");
    }
    // Generic: show key=value pairs
    return Object.entries(obj)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(item);
}

/** Icon mapping for artifact types */
function ArtifactIcon({ type }: { type: string }) {
  switch (type) {
    case "schema_discovered":
    case "schema":
      return <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case "models_found":
    case "conventions":
    case "source_code":
      return <FileCode className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    case "dbt_run_output":
    case "test_results":
    case "verification":
      return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    default:
      return <Info className="h-3.5 w-3.5 text-gray-500 shrink-0" />;
  }
}

/** Renders a list of artifacts as compact cards with collapsible item lists */
function ArtifactSection({ artifacts }: { artifacts: SaisInterruptArtifact[] }) {
  if (artifacts.length === 0) return null;

  return (
    <div className="mb-3">
      <details open>
        <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 select-none">
          Artifacts ({artifacts.length})
        </summary>
        <div className="space-y-2">
          {artifacts.map((artifact, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-gray-200 bg-white/60 p-2 dark:border-gray-700 dark:bg-gray-800/60"
            >
              <ArtifactIcon type={artifact.type} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {artifact.label}
                </p>
                {artifact.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {artifact.summary}
                  </p>
                )}
                {artifact.items && artifact.items.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 select-none">
                      {artifact.items.length} item{artifact.items.length !== 1 ? "s" : ""}
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-2 text-xs text-gray-600 dark:text-gray-400">
                      {artifact.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="truncate">
                          {formatArtifactItem(item)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

interface InterruptApprovalProps {
  interruptValue: SaisInterruptValue;
  /** When true, renders as a historical read-only card with decision badge instead of buttons */
  isReadOnly?: boolean;
  /** The decision that was made ("approved" or "rejected") — only used when isReadOnly */
  decision?: "approved" | "rejected";
  /** User feedback text if rejected — only used when isReadOnly */
  feedback?: string | null;
}

/**
 * Shared approval/rejection UI for all SAIS interrupt types.
 * Renders the interrupt message (markdown), optional artifacts, and approve/reject buttons.
 * Handles plan_approval, research_approval, verify_approval, gate_confirmation,
 * and pipeline_resumption -- distinguished by type field with gate-specific labels.
 *
 * When isReadOnly=true, renders as a historical decision record with a badge
 * showing what was decided, instead of interactive buttons.
 */
export function InterruptApproval({ interruptValue, isReadOnly, decision, feedback: readOnlyFeedback }: InterruptApprovalProps) {
  const {
    loading,
    feedbackText,
    setFeedbackText,
    showFeedback,
    setShowFeedback,
    handleApprove,
    handleReject,
  } = useInterruptApproval();

  const interruptType = interruptValue.type;
  const isPlanApproval = interruptType === "plan_approval";
  const isResearchApproval = interruptType === "research_approval";
  const isVerifyApproval = interruptType === "verify_approval";
  const isGateConfirmation = interruptType === "gate_confirmation";
  const showRpabvStepper = isPlanApproval || isResearchApproval || isVerifyApproval;
  const showFeedbackOnReject = isPlanApproval || isResearchApproval || isVerifyApproval;

  // Title based on interrupt type and RPABV level
  // RPABVLevel enum is 1-based: DESIGN=1, PLAN=2, EXECUTE=3
  const levelLabels: Record<number, string> = {
    1: "Pipeline Design",
    2: "Implementation Plan",
    3: "Step Execution",
  };
  const rpabvLevel = interruptValue.rpabv_level ?? 1;
  const levelLabel = levelLabels[rpabvLevel] ?? `L${rpabvLevel}`;

  const titleMap: Record<string, string> = {
    plan_approval: `${levelLabel} Review (L${rpabvLevel})`,
    research_approval: "Review Research Results",
    verify_approval: "Review Verification Results",
    gate_confirmation: "Action Confirmation",
    pipeline_resumption: "Pipeline Resumption",
  };
  const title = titleMap[interruptType] ?? "Approval Required";

  // Button labels per gate type
  const approveLabelMap: Record<string, string> = {
    plan_approval: "Approve Plan",
    research_approval: "Proceed to Plan",
    verify_approval: "Accept Results",
    gate_confirmation: "Proceed",
    pipeline_resumption: "Continue",
  };
  const rejectLabelMap: Record<string, string> = {
    plan_approval: "Reject & Revise",
    research_approval: "Re-collect",
    verify_approval: "Request Changes",
    gate_confirmation: "Cancel",
    pipeline_resumption: "Cancel",
  };
  const approveLabel = approveLabelMap[interruptType] ?? "Approve";
  const rejectLabel = rejectLabelMap[interruptType] ?? "Reject";

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

      {/* RPABV stage stepper (plan_approval, research_approval, verify_approval) */}
      {showRpabvStepper && interruptValue.rpabv_progress && (
        <RPABVStepper
          progress={interruptValue.rpabv_progress}
          status={interruptValue.rpabv_status}
        />
      )}

      {/* Artifacts section (research/verify/any gate with artifacts) */}
      {interruptValue.artifacts && interruptValue.artifacts.length > 0 && (
        <ArtifactSection artifacts={interruptValue.artifacts} />
      )}

      {/* Render the interrupt message as markdown */}
      <div className="mb-4 rounded-md bg-white/80 p-3 dark:bg-gray-900/50">
        <MarkdownText>{interruptValue.message}</MarkdownText>
      </div>

      {/* Read-only decision badge (historical cards) */}
      {isReadOnly && decision && (
        <div className="flex items-center gap-2">
          {decision === "approved" ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-300">
              <XCircle className="h-3.5 w-3.5" />
              Rejected
            </div>
          )}
          {readOnlyFeedback && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              {readOnlyFeedback}
            </p>
          )}
        </div>
      )}

      {/* Feedback input (shown on reject for plan_approval) */}
      {!isReadOnly && showFeedback && (
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
      {!isReadOnly && !showFeedback && (
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
              if (showFeedbackOnReject) {
                // Show feedback input for plan/research/verify rejections
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
