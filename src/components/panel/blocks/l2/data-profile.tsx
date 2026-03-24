"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Table2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  DataProfileData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DataProfileBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * L2 data-profile block: column stats table with quality issues.
 *
 * Compact: "Profile: orders (12 cols, 15% null in amount)"
 * Expanded: full column table.
 * Canvas expand: opens table renderer (D-14, D-15).
 */
/**
 * Normalise backend profile data into the shape the component renders.
 * Backend sends: {profile_results: {tableName: [{column_name, data_type, null_pct, cardinality, ...}]}}
 * Component needs: {columns: [{name, type, null_rate, cardinality}]}
 */
function normaliseProfileData(
  raw: Record<string, unknown> | undefined,
): DataProfileData | undefined {
  if (!raw) return undefined;

  // Already in the expected shape (future-proof)
  if (Array.isArray((raw as unknown as DataProfileData).columns)) {
    return raw as unknown as DataProfileData;
  }

  // Backend shape: {profile_results: {tableName: [...]}}
  const profileResults = raw.profile_results as
    | Record<string, Array<Record<string, unknown>>>
    | undefined;
  if (!profileResults || typeof profileResults !== "object") return undefined;

  // Flatten all tables into a single column list
  const columns: DataProfileData["columns"] = [];
  for (const rows of Object.values(profileResults)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      columns.push({
        name: (row.column_name as string) ?? (row.name as string) ?? "",
        type: (row.data_type as string) ?? (row.type as string) ?? "",
        null_rate: (row.null_pct as number) ?? (row.null_rate as number) ?? 0,
        cardinality: (row.cardinality as number) ?? 0,
      });
    }
  }
  return columns.length > 0 ? { columns } : undefined;
}

export function DataProfileBlock({
  block,
  state,
  onCanvasOpen,
}: DataProfileBlockProps) {
  const data = normaliseProfileData(
    block.data as Record<string, unknown> | undefined,
  );
  const [expanded, setExpanded] = useState(false);

  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-28 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const columns = data.columns ?? [];
  const highNullCols = columns.filter((c) => c.null_rate > 0.1);
  const compactLine = `${columns.length} columns${highNullCols.length > 0 ? `, ${highNullCols.length} with >10% nulls` : ""}`;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <Table2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Data Profile
        </span>
        <span className="text-xs text-muted-foreground/60">{compactLine}</span>
      </button>

      {/* Compact: one-liner */}
      {!expanded && highNullCols.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 ml-5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {highNullCols.map((c) => c.name).join(", ")} have high null rates
        </p>
      )}

      {/* Expanded: column table */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-2">
          <div className="overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground/70 border-b border-border">
                  <th className="text-left py-1 pr-3 font-medium">Column</th>
                  <th className="text-left py-1 pr-3 font-medium">Type</th>
                  <th className="text-right py-1 pr-3 font-medium">Null %</th>
                  <th className="text-right py-1 font-medium">Cardinality</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-1 pr-3 font-medium text-foreground">
                      {col.name}
                    </td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {col.type}
                    </td>
                    <td
                      className={`py-1 pr-3 text-right ${col.null_rate > 0.1 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                    >
                      {Math.round(col.null_rate * 100)}%
                    </td>
                    <td className="py-1 text-right text-muted-foreground">
                      {col.cardinality.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Canvas expand affordance (D-14, D-15) */}
          {onCanvasOpen && (
            <button
              onClick={() => {
                // Transform column metadata into rows for TableRenderer
                // TableRenderer expects { rows: Record<string, unknown>[] }
                const rows = columns.map((col) => ({
                  Column: col.name,
                  Type: col.type,
                  "Null %": `${Math.round(col.null_rate * 100)}%`,
                  Cardinality: col.cardinality,
                }));
                onCanvasOpen("table", { rows });
              }}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View table
            </button>
          )}
        </div>
      )}
    </div>
  );
}
