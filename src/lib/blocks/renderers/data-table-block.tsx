"use client";

import type { BlockRendererProps } from "../types";
import type { DataTableBlockData } from "../types";

export function DataTableBlock({ block }: BlockRendererProps) {
  const data = block as DataTableBlockData;

  if (!data.columns?.length || !data.rows?.length) {
    return null;
  }

  return (
    <div className="my-3">
      {data.title && (
        <h4 className="text-foreground mb-2 text-sm font-semibold">
          {data.title}
        </h4>
      )}
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="text-foreground px-4 py-2 text-left font-semibold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 1 ? "bg-muted/50" : ""}
              >
                {data.columns.map((col) => (
                  <td
                    key={col}
                    className="border-border text-foreground border-t px-4 py-2"
                  >
                    {row[col] != null ? String(row[col]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
