/**
 * ImpactPanel - Side panel showing downstream impact analysis results.
 *
 * Displays total affected count, count strip by risk level (red/orange/yellow),
 * and a scrollable detail list grouped by risk level with clickable items.
 * Supports "dim unaffected" and "hide unaffected" focus modes.
 */
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  AlertTriangle,
  AlertCircle,
  Info,
  Database,
  BarChart3,
  Cog,
  Columns3,
  Target,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ImpactResult, ImpactedNode, RiskLevel } from "@/lib/lineage-api";

// -- Constants ----------------------------------------------------------------

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; bg: string; text: string; border: string; Icon: React.ElementType }
> = {
  critical: {
    label: "Critical",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500",
    Icon: Zap,
  },
  high: {
    label: "High",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500",
    Icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-500",
    Icon: AlertCircle,
  },
  low: {
    label: "Low",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-400",
    Icon: Info,
  },
};

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

// -- Props -------------------------------------------------------------------

interface ImpactPanelProps {
  /** Impact analysis result, or null to hide. */
  impactResult: ImpactResult | null;
  /** Callback to close the panel and clear impact state. */
  onClose: () => void;
  /** Callback when a node in the detail list is clicked. */
  onNodeClick?: (nodeId: string) => void;
  /** Whether dim-unaffected mode is active. */
  dimUnaffected: boolean;
  /** Toggle dim-unaffected mode. */
  onToggleDim: () => void;
  /** Whether hide-unaffected mode is active. */
  hideUnaffected: boolean;
  /** Toggle hide-unaffected mode. */
  onToggleHide: () => void;
}

// -- Helpers -----------------------------------------------------------------

function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "metabase.card":
      return <BarChart3 className="h-3.5 w-3.5 text-purple-600" />;
    case "warehouse.table":
      return <Database className="h-3.5 w-3.5 text-blue-600" />;
    case "warehouse.column":
      return <Columns3 className="h-3.5 w-3.5 text-gray-600" />;
    case "dbt.model":
    case "dbt.source":
      return <Cog className="h-3.5 w-3.5 text-green-600" />;
    case "metric.kpi":
      return <Target className="h-3.5 w-3.5 text-orange-600" />;
    default:
      return <Database className="h-3.5 w-3.5 text-gray-500" />;
  }
}

// -- Count strip badge --------------------------------------------------------

function RiskBadge({
  level,
  count,
}: {
  level: RiskLevel;
  count: number;
}) {
  if (count === 0) return null;
  const config = RISK_CONFIG[level];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <config.Icon className="h-3 w-3" />
      {count} {config.label.toLowerCase()}
    </span>
  );
}

// -- Detail item --------------------------------------------------------------

function ImpactDetailItem({
  node,
  onClick,
}: {
  node: ImpactedNode;
  onClick?: () => void;
}) {
  const config = RISK_CONFIG[node.risk_level];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-md border-l-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${config.border}`}
    >
      <NodeTypeIcon type={node.type} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {node.label}
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          depth {node.depth} &middot; {node.risk_reason}
        </span>
      </div>
    </button>
  );
}

// -- Main component -----------------------------------------------------------

export function ImpactPanel({
  impactResult,
  onClose,
  onNodeClick,
  dimUnaffected,
  onToggleDim,
  hideUnaffected,
  onToggleHide,
}: ImpactPanelProps) {
  const groupedNodes = useMemo(() => {
    if (!impactResult) return {};
    const groups: Partial<Record<RiskLevel, ImpactedNode[]>> = {};
    for (const level of RISK_ORDER) {
      const items = impactResult.impacted_nodes.filter(
        (n) => n.risk_level === level,
      );
      if (items.length > 0) {
        groups[level] = items;
      }
    }
    return groups;
  }, [impactResult]);

  return (
    <AnimatePresence>
      {impactResult && (
        <motion.div
          key="impact-panel"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="impact-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Impact Analysis
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Close impact panel"
              data-testid="impact-panel-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Summary section */}
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Impact from changing
            </p>
            <p className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {impactResult.root_label}
            </p>

            {/* Total affected count */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {impactResult.total_affected}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                affected {impactResult.total_affected === 1 ? "node" : "nodes"}
              </span>
            </div>

            {/* Count strip */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RISK_ORDER.map((level) => (
                <RiskBadge
                  key={level}
                  level={level}
                  count={impactResult.by_risk[level] ?? 0}
                />
              ))}
            </div>
          </div>

          {/* Focus mode controls */}
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
            <button
              type="button"
              onClick={onToggleDim}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                dimUnaffected
                  ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              title="Dim unaffected nodes"
            >
              <Eye className="h-3 w-3" />
              Dim
            </button>
            <button
              type="button"
              onClick={onToggleHide}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                hideUnaffected
                  ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              title="Hide unaffected nodes"
            >
              <EyeOff className="h-3 w-3" />
              Hide
            </button>
          </div>

          {/* Detail list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {impactResult.total_affected === 0 ? (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                No downstream dependencies found.
              </p>
            ) : (
              <div className="space-y-4">
                {RISK_ORDER.map((level) => {
                  const items = groupedNodes[level];
                  if (!items) return null;
                  const config = RISK_CONFIG[level];

                  return (
                    <div key={level}>
                      <h4
                        className={`mb-1.5 text-xs font-semibold uppercase ${config.text}`}
                      >
                        {config.label} ({items.length})
                      </h4>
                      <div className="space-y-1">
                        {items.map((node) => (
                          <ImpactDetailItem
                            key={node.node_id}
                            node={node}
                            onClick={
                              onNodeClick
                                ? () => onNodeClick(node.node_id)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
            <p className="text-[10px] text-zinc-400">
              Max depth: {impactResult.max_depth} &middot; Root:{" "}
              {impactResult.root_node_id.slice(0, 8)}...
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
