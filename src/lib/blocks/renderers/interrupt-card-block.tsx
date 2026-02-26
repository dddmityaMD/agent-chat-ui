"use client";

import { useState } from "react";
import type { BlockRendererProps, InterruptCardBlockData } from "../types";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/thread/markdown-text";
import {
  Check,
  X,
  MessageSquare,
  Database,
  FileCode,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Shield,
} from "lucide-react";

// --- RPABV stepper (migrated from interrupt-approval.tsx) ---

const RPABV_STAGES = [
  { key: "research", letter: "R", label: "Research" },
  { key: "plan", letter: "P", label: "Plan" },
  { key: "approve", letter: "A", label: "Approve" },
  { key: "build", letter: "B", label: "Build" },
  { key: "verify", letter: "V", label: "Verify" },
] as const;

function RPABVStepper({
  progress,
}: {
  progress: Record<string, unknown>;
}) {
  const stage = progress.stage as string | undefined;
  const currentIdx = RPABV_STAGES.findIndex((s) => s.key === stage);
  const stepIndex = progress.step_index as number | null | undefined;
  const totalSteps = progress.total_steps as number | null | undefined;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5">
        {RPABV_STAGES.map((s, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-1.5">
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
                title={s.label}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isCompleted
                      ? "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300"
                      : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                {s.letter}
              </div>
            </div>
          );
        })}
      </div>
      {stepIndex != null && totalSteps != null && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Step {stepIndex + 1} of {totalSteps}
        </p>
      )}
    </div>
  );
}

// --- Artifact rendering (migrated from interrupt-approval.tsx) ---

interface ArtifactData {
  type: string;
  label: string;
  items?: unknown[];
  summary?: string;
}

function formatArtifactItem(item: unknown): string {
  if (typeof item === "string") {
    const enumMatch = item.match(/^[A-Za-z]+\.([A-Z_]+)$/);
    if (enumMatch) {
      return enumMatch[1]
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
    }
    return item;
  }
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (obj.name) {
      const parts = [String(obj.name)];
      if (obj.type) parts.push(`(${obj.type})`);
      if (obj.path) parts.push(`-- ${obj.path}`);
      return parts.join(" ");
    }
    return Object.entries(obj)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(item);
}

function ArtifactIcon({ type }: { type: string }) {
  switch (type) {
    case "schema_discovered":
    case "schema":
    case "sources":
      return <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case "existing_models":
    case "conventions":
    case "source_code":
      return <FileCode className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    case "verification_result":
    case "verification_method":
    case "dbt_run_output":
    case "test_results":
      return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    default:
      return <Info className="h-3.5 w-3.5 text-gray-500 shrink-0" />;
  }
}

function ArtifactSection({ artifacts }: { artifacts: ArtifactData[] }) {
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
                      {artifact.items.length} item
                      {artifact.items.length !== 1 ? "s" : ""}
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

// --- Title and label maps ---

const TITLE_MAP: Record<string, string> = {
  plan_approval: "Plan Review",
  research_approval: "Review Research Results",
  verify_approval: "Review Verification Results",
  gate_confirmation: "Action Confirmation",
  pipeline_resumption: "Pipeline Resumption",
  sandbox_approval: "Sandbox Preview",
};

const APPROVE_LABEL_MAP: Record<string, string> = {
  plan_approval: "Approve Plan",
  research_approval: "Proceed to Plan",
  verify_approval: "Accept Results",
  gate_confirmation: "Proceed",
  pipeline_resumption: "Continue",
  sandbox_approval: "Apply Changes",
};

const REJECT_LABEL_MAP: Record<string, string> = {
  plan_approval: "Reject & Revise",
  research_approval: "Re-collect",
  verify_approval: "Request Changes",
  gate_confirmation: "Cancel",
  pipeline_resumption: "Cancel",
  sandbox_approval: "Reject Changes",
};

const SHOW_FEEDBACK_TYPES = new Set([
  "plan_approval",
  "research_approval",
  "verify_approval",
  "sandbox_approval",
]);

// --- Sandbox preview rendering ---

interface SandboxOperation {
  action: string;
  target: string;
  description?: string;
}

interface GeneratedCodeItem {
  filename: string;
  language: string;
  content: string;
}

interface LintResult {
  gate: string;
  passed: boolean;
  message?: string;
}

interface SandboxArtifacts {
  sandbox_render_mode?: "diff_summary" | "code_preview";
  operations?: SandboxOperation[];
  preview_url?: string;
  generated_code?: GeneratedCodeItem[];
  lint_results?: LintResult[];
}

function SandboxPreview({ artifacts }: { artifacts: SandboxArtifacts }) {
  const mode = artifacts.sandbox_render_mode;
  if (!mode) return null;

  if (mode === "diff_summary") {
    return (
      <div className="mb-4 rounded-md border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-950/50">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="text-xs font-semibold text-orange-800 dark:text-orange-200">
            Planned Changes
          </span>
        </div>
        {artifacts.operations && artifacts.operations.length > 0 && (
          <ul className="space-y-1">
            {artifacts.operations.map((op, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300"
              >
                <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                  {op.action}
                </span>
                <span className="font-medium">{op.target}</span>
                {op.description && (
                  <span className="text-gray-500 dark:text-gray-400">
                    -- {op.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {artifacts.preview_url && (
          <a
            href={artifacts.preview_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink className="h-3 w-3" />
            Preview
          </a>
        )}
      </div>
    );
  }

  if (mode === "code_preview") {
    return (
      <div className="mb-4 space-y-3">
        {/* Generated code blocks */}
        {artifacts.generated_code && artifacts.generated_code.length > 0 && (
          <div className="space-y-2">
            {artifacts.generated_code.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <FileCode className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {item.filename}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                    {item.language}
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                  <MarkdownText>{`\`\`\`${item.language}\n${item.content}\n\`\`\``}</MarkdownText>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lint/gate results */}
        {artifacts.lint_results && artifacts.lint_results.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-white/80 p-2 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              Gate Results
            </p>
            <div className="space-y-0.5">
              {artifacts.lint_results.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {result.passed ? (
                    <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                  )}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {result.gate}
                  </span>
                  {result.message && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {result.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// --- Main component ---

/**
 * Interrupt card block renderer.
 *
 * Two states:
 * 1. Active (isActive=true): Shows card content + approve/reject buttons
 *    with inline rejection feedback textarea.
 * 2. Resolved (decision present in block data): Shows card content +
 *    decision badge with timestamp and optional feedback text.
 *
 * Phase 23.4: Single rendering path for live and historical interrupt cards.
 * Cards are regular messages in chronological position, rendered from blocks.
 */
export function InterruptCardBlock({
  block,
  isActive,
  onApprove,
  onReject,
}: BlockRendererProps) {
  const data = block as InterruptCardBlockData;
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState("");

  const cardType = data.card_type || "";
  const title = TITLE_MAP[cardType] ?? "Approval Required";
  const approveLabel = APPROVE_LABEL_MAP[cardType] ?? "Approve";
  const rejectLabel = REJECT_LABEL_MAP[cardType] ?? "Reject";
  const showFeedbackOnReject = SHOW_FEEDBACK_TYPES.has(cardType);
  const showRpabvStepper =
    SHOW_FEEDBACK_TYPES.has(cardType) && data.rpabv_progress;
  const artifacts = (data.artifacts ?? []) as ArtifactData[];

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {title}
        </h3>
      </div>

      {/* RPABV stage stepper */}
      {showRpabvStepper && data.rpabv_progress && (
        <RPABVStepper progress={data.rpabv_progress} />
      )}

      {/* Artifacts section */}
      {artifacts.length > 0 && <ArtifactSection artifacts={artifacts} />}

      {/* Sandbox preview (render_mode-driven, no connector_type branching) */}
      {cardType === "sandbox_approval" && (() => {
        // Sandbox data can be in block-level fields (via BlockData index signature)
        // or inside the first artifacts array item
        const blockAny = data as Record<string, unknown>;
        const sandboxData: SandboxArtifacts = blockAny.sandbox_render_mode
          ? (blockAny as unknown as SandboxArtifacts)
          : artifacts.length > 0
            ? (artifacts[0] as unknown as SandboxArtifacts)
            : {};
        return sandboxData.sandbox_render_mode ? (
          <SandboxPreview artifacts={sandboxData} />
        ) : null;
      })()}

      {/* Card message as markdown */}
      {data.message && (
        <div className="mb-4 rounded-md bg-white/80 p-3 dark:bg-gray-900/50">
          <MarkdownText>{data.message}</MarkdownText>
        </div>
      )}

      {/* Active state: approve/reject buttons with inline feedback */}
      {isActive && (
        <div className="space-y-2">
          {showFeedbackInput && (
            <div className="mb-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what should change..."
                className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                rows={3}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject?.(feedback)}
                >
                  Submit Rejection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowFeedbackInput(false);
                    setFeedback("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!showFeedbackInput && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onApprove?.()}
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
                    setShowFeedbackInput(true);
                  } else {
                    onReject?.();
                  }
                }}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                {rejectLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Resolved state: decision badge */}
      {!isActive && data.decision && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          {data.decision === "approved" ? (
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
          {data.decided_at && (
            <span className="text-xs">
              {new Date(data.decided_at).toLocaleTimeString()}
            </span>
          )}
          {data.feedback && (
            <p className="text-xs italic">{data.feedback}</p>
          )}
        </div>
      )}
    </div>
  );
}
