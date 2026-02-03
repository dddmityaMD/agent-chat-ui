/**
 * DiffCard - Expandable card showing a single fix proposal.
 *
 * Collapsed state shows title, scope badge, risk level badge, and one-line
 * description. Expanded state shows the full DiffViewer, explanation,
 * downstream impact list, and approve/reject action buttons.
 */

"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Database,
  BarChart3,
  AlertTriangle,
  Check,
  X,
  Link2,
} from "lucide-react";
import { DiffViewer } from "./DiffViewer";

export interface RemediationProposalData {
  fix_id: string;
  title: string;
  scope: "sql" | "dbt" | "metabase";
  risk_level: "low" | "medium" | "high";
  description: string;
  diff_preview: string;
  original_content: string;
  proposed_content: string;
  target_ref: string;
  downstream_impact: Array<{
    node_id?: string;
    label?: string;
    type?: string;
    risk_level?: string;
    risk_reason?: string;
    depth?: number;
  }>;
  evidence_refs: string[];
  explanation: string;
}

export interface DiffCardProps {
  proposal: RemediationProposalData;
  onApprove: (fixId: string) => void;
  onReject: (fixId: string) => void;
  /** Current status of this card */
  status?: "pending" | "approved" | "rejected";
}

const SCOPE_CONFIG: Record<
  string,
  { label: string; icon: typeof FileCode; className: string }
> = {
  sql: {
    label: "SQL",
    icon: Database,
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  dbt: {
    label: "dbt",
    icon: FileCode,
    className:
      "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  metabase: {
    label: "Metabase",
    icon: BarChart3,
    className:
      "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
};

const RISK_CONFIG: Record<
  string,
  { label: string; className: string; borderColor: string }
> = {
  low: {
    label: "Low Risk",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    borderColor: "border-l-green-400",
  },
  medium: {
    label: "Medium Risk",
    className:
      "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    borderColor: "border-l-yellow-400",
  },
  high: {
    label: "High Risk",
    className:
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    borderColor: "border-l-red-400",
  },
};

const STATUS_STYLES: Record<string, string> = {
  approved:
    "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/10",
  rejected:
    "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10",
  pending: "",
};

export function DiffCard({
  proposal,
  onApprove,
  onReject,
  status = "pending",
}: DiffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const scopeConfig = SCOPE_CONFIG[proposal.scope] || SCOPE_CONFIG.sql;
  const riskConfig = RISK_CONFIG[proposal.risk_level] || RISK_CONFIG.medium;
  const ScopeIcon = scopeConfig.icon;

  const impactCount = proposal.downstream_impact.length;
  const evidenceCount = proposal.evidence_refs.length;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-l-4 transition-shadow hover:shadow-md ${riskConfig.borderColor} ${STATUS_STYLES[status] || ""}`}
      data-testid="diff-card"
    >
      {/* Collapsed header (always visible) */}
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Expand indicator */}
        <span className="mt-0.5 shrink-0 text-gray-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* Status indicator */}
        {status === "approved" && (
          <span className="mt-0.5 shrink-0 text-green-500">
            <Check className="h-4 w-4" />
          </span>
        )}
        {status === "rejected" && (
          <span className="mt-0.5 shrink-0 text-red-500">
            <X className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {proposal.title}
            </h3>

            {/* Scope badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${scopeConfig.className}`}
            >
              <ScopeIcon className="h-3 w-3" aria-hidden="true" />
              {scopeConfig.label}
            </span>

            {/* Risk badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${riskConfig.className}`}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {riskConfig.label}
            </span>
          </div>

          {/* Description */}
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {proposal.description}
          </p>

          {/* Meta info */}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Based on {evidenceCount} evidence item{evidenceCount !== 1 ? "s" : ""}
            </span>
            {impactCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {impactCount} downstream item{impactCount !== 1 ? "s" : ""} affected
              </span>
            )}
            <span className="font-mono text-gray-400">{proposal.target_ref}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Diff viewer */}
          <div className="p-4">
            <DiffViewer diff={proposal.diff_preview} maxHeight={300} />
          </div>

          {/* Explanation (expandable) */}
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                setShowExplanation((v) => !v);
              }}
            >
              {showExplanation ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Why this fix?
            </button>
            {showExplanation && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {proposal.explanation}
              </p>
            )}
          </div>

          {/* Downstream impact */}
          {impactCount > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Downstream Impact
              </h4>
              <ul className="mt-1 space-y-1">
                {proposal.downstream_impact.slice(0, 10).map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        item.risk_level === "critical"
                          ? "bg-red-500"
                          : item.risk_level === "high"
                            ? "bg-orange-500"
                            : item.risk_level === "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                      }`}
                    />
                    <span>{item.label || item.node_id}</span>
                    <span className="text-gray-400">({item.type})</span>
                    {item.risk_reason && (
                      <span className="text-gray-400">- {item.risk_reason}</span>
                    )}
                  </li>
                ))}
                {impactCount > 10 && (
                  <li className="text-xs text-gray-500">
                    ...and {impactCount - 10} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          {status === "pending" && (
            <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(proposal.fix_id);
                }}
                data-testid="reject-fix-btn"
              >
                <X className="h-3 w-3" />
                Reject
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(proposal.fix_id);
                }}
                data-testid="approve-fix-btn"
              >
                <Check className="h-3 w-3" />
                Approve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
