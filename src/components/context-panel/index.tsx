"use client";

/**
 * Context Panel - Thread-level agent context overview.
 *
 * Collapsible section for embedding in the case panel sidebar.
 * Shows a human-readable summary of what the agent "sees":
 * - Resolved entities as compact tags
 * - Detected intent with confidence
 * - Active flow and RPABV stage
 * - Key decisions (build plan status, approvals)
 *
 * Reads from useSaisUi() for real-time streaming data.
 * Collapsed by default with a visible left arrow indicator.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Brain, Zap, GitBranch, CheckCircle2 } from "lucide-react";
import { useSaisUi } from "@/hooks/useSaisUi";

/** Safely extract a string field from a passthrough object */
function extractStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val.length > 0 ? val : null;
}

/** Safely extract a number field from a passthrough object */
function extractNumberField(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "number" ? val : null;
}

interface ContextPanelSectionProps {
  threadId: string | null;
}

export function ContextPanelSection({ threadId }: ContextPanelSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const saisUi = useSaisUi();

  return (
    <div className="mt-4 grid gap-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-sm font-semibold"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="context-panel-toggle"
      >
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span>Agent Context</span>
      </button>
      {isOpen && (
        <div className="rounded-md border bg-card p-3">
          <div className="flex flex-col gap-3">
            {!threadId && (
              <p className="text-muted-foreground text-sm">
                No thread selected. Start a conversation to see agent context.
              </p>
            )}

            {threadId && (
              <>
                {/* Resolved Entities */}
                <ResolvedEntitiesSection entities={saisUi.groundedEntities} />

                {/* Detected Intent */}
                <DetectedIntentSection
                  intent={extractStringField(saisUi.raw, "intent")}
                  confidence={extractNumberField(saisUi.raw, "intent_confidence")}
                />

                {/* Active Flow */}
                <ActiveFlowSection
                  flowType={saisUi.flowType}
                  rpabvStage={extractStringField(saisUi.raw, "rpabv_stage")}
                />

                {/* Key Decisions */}
                <KeyDecisionsSection
                  buildPlanStatus={saisUi.buildPlanStatus}
                  hasPermissionGrants={saisUi.hasPermissionGrants}
                  permissionGrantCount={saisUi.permissionGrants.length}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use ContextPanelSection instead */
export const ContextPanel = ContextPanelSection;

/* ----- Sub-sections ----- */

function ResolvedEntitiesSection({
  entities,
}: {
  entities: Array<{ canonical_key: string; name: string }>;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Brain className="size-3.5 text-violet-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resolved Entities
        </h3>
      </div>
      {entities.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entities resolved yet</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {entities.map((entity) => (
            <span
              key={entity.canonical_key}
              className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
              title={entity.canonical_key}
            >
              {entity.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function DetectedIntentSection({
  intent,
  confidence,
}: {
  intent: string | null;
  confidence: number | null;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Zap className="size-3.5 text-blue-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Detected Intent
        </h3>
      </div>
      {!intent ? (
        <p className="text-xs text-muted-foreground">No intent classified yet</p>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          {intent}
          {confidence != null && (
            <span className="text-blue-500">
              ({(confidence * 100).toFixed(0)}%)
            </span>
          )}
        </span>
      )}
    </section>
  );
}

function ActiveFlowSection({
  flowType,
  rpabvStage,
}: {
  flowType: string | null;
  rpabvStage: string | null;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <GitBranch className="size-3.5 text-purple-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active Flow
        </h3>
      </div>
      {!flowType ? (
        <p className="text-xs text-muted-foreground">No active flow</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            {flowType}
          </span>
          {rpabvStage && rpabvStage.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {rpabvStage}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function KeyDecisionsSection({
  buildPlanStatus,
  hasPermissionGrants,
  permissionGrantCount,
}: {
  buildPlanStatus: string | null;
  hasPermissionGrants: boolean;
  permissionGrantCount: number;
}) {
  const hasAnyDecision = buildPlanStatus || hasPermissionGrants;

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 text-green-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key Decisions
        </h3>
      </div>
      {!hasAnyDecision ? (
        <p className="text-xs text-muted-foreground">No decisions recorded yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {buildPlanStatus && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Build plan:</span>
              <BuildPlanStatusBadge status={buildPlanStatus} />
            </div>
          )}
          {hasPermissionGrants && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Permissions:</span>
              <span className="font-medium text-amber-700">
                {permissionGrantCount} active grant{permissionGrantCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BuildPlanStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    proposed: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    executing: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  const colorClass = colorMap[status] || "bg-gray-100 text-gray-800";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}
