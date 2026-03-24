"use client";

import React, { useMemo } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TableRendererProps {
  /**
   * Expected shape: { rows: Record<string, unknown>[]; columns?: string[] }
   * If columns omitted, auto-detect from first row keys.
   */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

interface TableData {
  rows: Record<string, unknown>[];
  columns?: string[];
}

function isTableData(v: unknown): v is TableData {
  return (
    v != null &&
    typeof v === "object" &&
    "rows" in v &&
    Array.isArray((v as TableData).rows)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TableRenderer({ data }: TableRendererProps) {
  const valid = isTableData(data) && data.rows.length > 0;

  const columns = useMemo(() => {
    if (!valid) return [];
    const d = data as TableData;
    return d.columns ?? Object.keys(d.rows[0] ?? {});
  }, [valid, data]);

  if (!valid) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No table data available
      </div>
    );
  }

  const rows = (data as TableData).rows;

  return (
    <div className="h-full w-full overflow-auto p-4" data-testid="table-renderer">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 sticky top-0"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="py-1.5 px-3 text-zinc-700 dark:text-zinc-300"
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
