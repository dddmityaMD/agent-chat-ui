"use client";

/**
 * Context Panel - Thread-level agent context overview.
 *
 * Collapsible section for embedding in the case panel sidebar.
 * Shows a human-readable summary of what the agent "sees":
 * - Resolved entities as compact tags
 * - Active methodology / focused mode
 * - Current stage when present
 * - Key decisions (build plan status, approvals)
 *
 * Reads from useSaisUi() for real-time streaming data.
 * Collapsed by default with a visible left arrow indicator.
 */

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  GitBranch,
  CheckCircle2,
} from "lucide-react";
import { useSaisUi } from "@/hooks/useSaisUi";

/** Safely extract a string field from a passthrough object */
function extractStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val.length > 0 ? val : null;
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
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        )}
        <span>Agent Context</span>
      </button>
      {isOpen && (
        <div className="bg-card rounded-md border p-3">
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

                {/* Active Flow */}
                <ActiveFlowSection
                  methodologyType={saisUi.methodologyType}
                  methodologyStage={extractStringField(
                    saisUi.raw,
                    "methodology_stage",
                  )}
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
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Resolved Entities
        </h3>
      </div>
      {entities.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No entities resolved yet
        </p>
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

function ActiveFlowSection({
  methodologyType,
  methodologyStage,
}: {
  methodologyType: string | null;
  methodologyStage: string | null;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <GitBranch className="size-3.5 text-purple-500" />
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Active Methodology
        </h3>
      </div>
      {!methodologyType ? (
        <p className="text-muted-foreground text-xs">No active methodology</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            {methodologyType}
          </span>
          {methodologyStage && methodologyStage.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {methodologyStage}
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
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Key Decisions
        </h3>
      </div>
      {!hasAnyDecision ? (
        <p className="text-muted-foreground text-xs">
          No decisions recorded yet
        </p>
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
                {permissionGrantCount} active grant
                {permissionGrantCount !== 1 ? "s" : ""}
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
