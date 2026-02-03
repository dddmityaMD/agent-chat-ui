/**
 * NodeDetailPanel - Right-side slide-in panel showing node details on click.
 *
 * Renders type-specific properties for each lineage node type:
 * - Card/Report: name, collection, description, Metabase URL
 * - Table: schema, table name, row/column count
 * - Column: column name, data type, table, nullability
 * - dbt Model: name, schema, materialization, description
 * - KPI: name, definition, formula
 */
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Database,
  BarChart3,
  Cog,
  Columns3,
  Target,
  ExternalLink,
} from "lucide-react";
import type { LineageNodeData } from "@/lib/lineage-api";

// -- Props ------------------------------------------------------------------

interface NodeDetailPanelProps {
  /** The selected node data, or null to hide the panel. */
  selectedNode: LineageNodeData | null;
  /** Callback to close the panel. */
  onClose: () => void;
}

// -- Helpers ----------------------------------------------------------------

function getMetabaseUrl(nodeId: string): string {
  const base =
    process.env.NEXT_PUBLIC_METABASE_URL || "http://localhost:3001";
  // Extract numeric ID from node id (e.g., "metabase-card-42" -> "42")
  const match = nodeId.match(/(\d+)$/);
  const cardId = match ? match[1] : nodeId;
  return `${base}/question/${cardId}`;
}

/** Icon component based on node type. */
function NodeIcon({ type }: { type: string }) {
  switch (type) {
    case "metabase.card":
      return <BarChart3 className="h-5 w-5 text-purple-600" />;
    case "warehouse.table":
      return <Database className="h-5 w-5 text-blue-600" />;
    case "warehouse.column":
      return <Columns3 className="h-5 w-5 text-gray-600" />;
    case "dbt.model":
    case "dbt.source":
      return <Cog className="h-5 w-5 text-green-600" />;
    case "metric.kpi":
      return <Target className="h-5 w-5 text-orange-600" />;
    default:
      return <Database className="h-5 w-5 text-gray-500" />;
  }
}

/** Human-readable type label. */
function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    "metabase.card": "Metabase Card",
    "warehouse.table": "Table",
    "warehouse.column": "Column",
    "dbt.model": "dbt Model",
    "dbt.source": "dbt Source",
    "metric.kpi": "KPI",
  };
  return labels[type] ?? type;
}

// -- Detail renderers per node type -----------------------------------------

function CardDetails({ node }: { node: LineageNodeData }) {
  const collection = node.props?.collection as string | undefined;
  const description = node.props?.description as string | undefined;
  const url = getMetabaseUrl(node.id);

  return (
    <div className="space-y-3">
      <DetailRow label="Name" value={node.label} />
      {collection && <DetailRow label="Collection" value={collection} />}
      {description && <DetailRow label="Description" value={description} />}
      <div className="pt-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Metabase URL
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400"
        >
          Open in Metabase
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TableDetails({ node }: { node: LineageNodeData }) {
  const schema = node.props?.schema as string | undefined;
  const rowCount = node.props?.row_count as number | undefined;
  const columnCount = node.props?.column_count as number | undefined;

  return (
    <div className="space-y-3">
      <DetailRow label="Table" value={node.label} />
      {schema && <DetailRow label="Schema" value={schema} />}
      {rowCount != null && (
        <DetailRow label="Row Count" value={rowCount.toLocaleString()} />
      )}
      {columnCount != null && (
        <DetailRow label="Column Count" value={String(columnCount)} />
      )}
    </div>
  );
}

function ColumnDetails({ node }: { node: LineageNodeData }) {
  const dataType = node.props?.data_type as string | undefined;
  const tableName = node.props?.table_name as string | undefined;
  const nullable = node.props?.nullable as boolean | undefined;

  return (
    <div className="space-y-3">
      <DetailRow label="Column" value={node.label} />
      {dataType && <DetailRow label="Data Type" value={dataType} />}
      {tableName && <DetailRow label="Table" value={tableName} />}
      {nullable != null && (
        <DetailRow label="Nullable" value={nullable ? "Yes" : "No"} />
      )}
    </div>
  );
}

function DbtModelDetails({ node }: { node: LineageNodeData }) {
  const schema = node.props?.schema as string | undefined;
  const materialization = node.props?.materialization as string | undefined;
  const description = node.props?.description as string | undefined;
  const sourceTables = node.props?.source_tables as string[] | undefined;

  return (
    <div className="space-y-3">
      <DetailRow label="Model" value={node.label} />
      {schema && <DetailRow label="Schema" value={schema} />}
      {materialization && (
        <DetailRow label="Materialization" value={materialization} />
      )}
      {description && <DetailRow label="Description" value={description} />}
      {sourceTables && sourceTables.length > 0 && (
        <div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Source Tables
          </span>
          <ul className="mt-0.5 space-y-0.5">
            {sourceTables.map((t) => (
              <li key={t} className="text-sm text-zinc-700 dark:text-zinc-300">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KpiDetails({ node }: { node: LineageNodeData }) {
  const definition = node.props?.definition as string | undefined;
  const formula = node.props?.formula as string | undefined;

  return (
    <div className="space-y-3">
      <DetailRow label="KPI" value={node.label} />
      {definition && <DetailRow label="Definition" value={definition} />}
      {formula && (
        <div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Formula
          </span>
          <code className="mt-0.5 block rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {formula}
          </code>
        </div>
      )}
    </div>
  );
}

// -- Shared detail row ------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{value}</p>
    </div>
  );
}

// -- Main component ---------------------------------------------------------

function renderDetails(node: LineageNodeData) {
  switch (node.type) {
    case "metabase.card":
      return <CardDetails node={node} />;
    case "warehouse.table":
      return <TableDetails node={node} />;
    case "warehouse.column":
      return <ColumnDetails node={node} />;
    case "dbt.model":
    case "dbt.source":
      return <DbtModelDetails node={node} />;
    case "metric.kpi":
      return <KpiDetails node={node} />;
    default:
      return (
        <div className="space-y-3">
          <DetailRow label="Name" value={node.label} />
          <DetailRow label="Type" value={node.type} />
        </div>
      );
  }
}

export function NodeDetailPanel({ selectedNode, onClose }: NodeDetailPanelProps) {
  return (
    <AnimatePresence>
      {selectedNode && (
        <motion.div
          key="node-detail-panel"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 z-50 h-full w-80 overflow-y-auto border-l border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <NodeIcon type={selectedNode.type} />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {typeLabel(selectedNode.type)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Close detail panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            {renderDetails(selectedNode)}
          </div>

          {/* Canonical key footer */}
          {selectedNode.canonical_key && (
            <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <span className="text-[10px] font-medium uppercase text-zinc-400">
                Canonical Key
              </span>
              <p className="mt-0.5 break-all text-xs text-zinc-500">
                {selectedNode.canonical_key}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
