"use client";

/**
 * Build Artifacts tab - Shows build-specific artifacts only.
 *
 * Displays plan text, execution output (rpabv_artifacts), and verification
 * results from sais_ui fields. No flow timeline or interrupt cards -- those
 * live in the Flow tab (flow-tab.tsx).
 *
 * Data source: thread.values.sais_ui fields:
 * - build_plan (plan text string)
 * - build_plan_status (plan approval state)
 * - build_verification_result (verification output)
 * - rpabv_artifacts (execution artifacts -- generated code, SQL, etc.)
 */

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  FileCode,
} from "lucide-react";
import { useSaisUi } from "@/hooks/useSaisUi";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract a string from a sais_ui field */
function extractString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val.length > 0 ? val : null;
}

/** Safely extract an object from a sais_ui field */
function extractObject(obj: unknown, key: string): Record<string, unknown> | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

// ---------------------------------------------------------------------------
// Plan Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  proposed: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  executing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function PlanStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {status === "approved" || status === "completed" ? (
        <CheckCircle className="h-3 w-3" />
      ) : status === "rejected" || status === "failed" ? (
        <XCircle className="h-3 w-3" />
      ) : status === "executing" ? (
        <Clock className="h-3 w-3" />
      ) : null}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Artifact Section
// ---------------------------------------------------------------------------

function ArtifactSection({
  title,
  children,
  defaultExpanded,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {title}
      </button>
      {expanded && (
        <div className="border-t px-3 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RPABV Artifacts Display
// ---------------------------------------------------------------------------

function RpabvArtifactsDisplay({ artifacts }: { artifacts: Record<string, unknown> }) {
  const entries = Object.entries(artifacts).filter(
    ([, value]) => value != null && value !== "",
  );

  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No execution artifacts available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const items = Array.isArray(value) ? value : [value];
        const label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        return (
          <div key={key}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <FileCode className="h-3 w-3" />
              {label}
            </div>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={`${key}-${idx}`}
                  className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs font-mono whitespace-pre-wrap break-all"
                >
                  {typeof item === "string"
                    ? item
                    : JSON.stringify(item, null, 2)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verification Result Display
// ---------------------------------------------------------------------------

function VerificationResultDisplay({ result }: { result: Record<string, unknown> }) {
  const status = typeof result.status === "string" ? result.status : null;
  const message = typeof result.message === "string" ? result.message : null;
  const details = typeof result.details === "string" ? result.details : null;

  return (
    <div className="space-y-2">
      {status && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <PlanStatusBadge status={status} />
        </div>
      )}
      {message && (
        <div className="text-xs text-muted-foreground">
          {message}
        </div>
      )}
      {details && (
        <div className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs font-mono whitespace-pre-wrap">
          {details}
        </div>
      )}
      {/* Render any other fields as key-value pairs */}
      {Object.entries(result)
        .filter(([k]) => !["status", "message", "details"].includes(k))
        .filter(([, v]) => v != null)
        .map(([key, value]) => (
          <div key={key} className="text-xs">
            <span className="font-medium text-muted-foreground">
              {key.replace(/_/g, " ")}:
            </span>{" "}
            <span className="text-foreground">
              {typeof value === "string" ? value : JSON.stringify(value)}
            </span>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildArtifactsTab
// ---------------------------------------------------------------------------

export function BuildArtifactsTab({ threadId }: { threadId?: string | null }) {
  const saisUi = useSaisUi();
  const raw = saisUi.raw;

  // Extract build artifact data from sais_ui fields
  const buildPlan = extractString(raw, "build_plan");
  const buildPlanStatus = extractString(raw, "build_plan_status");
  const buildVerificationResult = extractObject(raw, "build_verification_result");
  const rpabvArtifacts = extractObject(raw, "rpabv_artifacts");

  const hasAnyData = buildPlan || buildPlanStatus || buildVerificationResult || rpabvArtifacts;

  if (!threadId) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No thread selected.
        </div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No build artifacts yet. Build artifacts will appear here when a build
          flow generates plans, code, or verification results.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Build Plan */}
      {buildPlan && (
        <ArtifactSection
          title={
            buildPlanStatus
              ? `Build Plan`
              : "Build Plan"
          }
          defaultExpanded
        >
          <div className="space-y-2">
            {buildPlanStatus && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <PlanStatusBadge status={buildPlanStatus} />
              </div>
            )}
            <div className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs whitespace-pre-wrap">
              {buildPlan}
            </div>
          </div>
        </ArtifactSection>
      )}

      {/* Build Plan Status (shown even without plan text) */}
      {!buildPlan && buildPlanStatus && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">Build status:</span>
          <PlanStatusBadge status={buildPlanStatus} />
        </div>
      )}

      {/* Execution Artifacts */}
      {rpabvArtifacts && (
        <ArtifactSection title="Execution Artifacts" defaultExpanded>
          <RpabvArtifactsDisplay artifacts={rpabvArtifacts} />
        </ArtifactSection>
      )}

      {/* Verification Results */}
      {buildVerificationResult && (
        <ArtifactSection title="Verification Results" defaultExpanded>
          <VerificationResultDisplay result={buildVerificationResult} />
        </ArtifactSection>
      )}
    </div>
  );
}
