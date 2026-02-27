"use client";

import { useState } from "react";
import type { BlockRendererProps, FindingsCardBlockData } from "../types";
import {
  Search,
  ChevronDown,
  ChevronRight,
  GitBranch,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Wrench,
  FlaskConical,
} from "lucide-react";
import { navigateToLineage } from "@/components/lineage-link";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400";
  if (pct >= 80) {
    colorClass = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400";
  } else if (pct >= 50) {
    colorClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400";
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {pct}%
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="flex-1">
          {title} ({count})
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function FindingsCardBlock({ block }: BlockRendererProps) {
  const data = block as FindingsCardBlockData;

  const entityContext = data.entity_context ?? [];
  const headerEntity = entityContext[0];
  const headerLabel = headerEntity
    ? `${headerEntity.entity_type}: ${headerEntity.display_name}`
    : "Investigation";

  const hasLineageEntities = entityContext.some((e) => e.uri);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <h3 className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
          Investigation: {headerLabel}
        </h3>
      </div>

      {/* Root Cause */}
      {data.root_cause && (
        <div className="mx-4 mb-3 rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
              Root Cause
            </span>
            <ConfidenceBadge confidence={data.root_cause.confidence} />
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {data.root_cause.statement}
          </p>
        </div>
      )}

      {/* Key Observations — always visible */}
      {data.key_observations && data.key_observations.length > 0 && (
        <div className="px-4 pb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Key Observations
          </p>
          <ul className="space-y-1">
            {data.key_observations.map((obs, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                <span className="flex-1">{obs.statement}</span>
                <ConfidenceBadge confidence={obs.confidence} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Fix — collapsible */}
      {data.recommended_fix && (
        <CollapsibleSection
          title="Recommended Fix"
          icon={Wrench}
          count={data.recommended_fix.steps?.length ?? 0}
        >
          <ol className="ml-4 list-decimal space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {data.recommended_fix.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {data.recommended_fix.risks && data.recommended_fix.risks.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Risks
              </p>
              <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                {data.recommended_fix.risks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
          {data.recommended_fix.validation_steps &&
            data.recommended_fix.validation_steps.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-medium text-green-600 dark:text-green-400">
                  Validation Steps
                </p>
                <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {data.recommended_fix.validation_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
        </CollapsibleSection>
      )}

      {/* Rejected Hypotheses — collapsible */}
      <CollapsibleSection
        title="Rejected Hypotheses"
        icon={XCircle}
        count={data.rejected_hypotheses?.length ?? 0}
      >
        <ul className="space-y-1.5">
          {data.rejected_hypotheses?.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {h.statement}
              </span>
              <span className="ml-1 text-xs text-gray-500">— {h.reason}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Open Questions — collapsible */}
      <CollapsibleSection
        title="Open Questions"
        icon={HelpCircle}
        count={data.open_questions?.length ?? 0}
      >
        <ul className="space-y-1.5">
          {data.open_questions?.map((q, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {q.question}
              </span>
              <span className="ml-1 text-xs text-gray-500">
                — {q.why_missing}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Next Tests — collapsible */}
      <CollapsibleSection
        title="Suggested Next Tests"
        icon={FlaskConical}
        count={data.next_tests?.length ?? 0}
      >
        <ul className="space-y-1.5">
          {data.next_tests?.map((t, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {t.test}
              </span>
              <span className="ml-1 text-xs text-gray-500">— {t.why}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* Lineage button */}
      {hasLineageEntities && (
        <div className="border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <button
            type="button"
            onClick={() =>
              navigateToLineage(
                entityContext.filter((e) => e.uri).map((e) => e.uri),
                entityContext.filter((e) => e.uri).map((e) => e.display_name),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <GitBranch className="h-3.5 w-3.5" />
            View in Lineage
          </button>
        </div>
      )}
    </div>
  );
}
