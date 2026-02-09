"use client";

/**
 * Graph Timing - Graph node execution timing display.
 *
 * Shows a simple table of graph nodes executed with their durations.
 * Falls back to "Timing data not available" when empty.
 */

import { cn } from "@/lib/utils";

interface GraphTimingNode {
  name: string;
  duration_ms: number;
}

interface GraphTimingProps {
  nodes: GraphTimingNode[];
}

export function GraphTiming({ nodes }: GraphTimingProps) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Graph Timing</h3>
      {nodes.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Timing data not available.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">
                  Node
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, i) => {
                const isLong = node.duration_ms > 2000;
                return (
                  <tr
                    key={`${node.name}-${i}`}
                    className={cn(
                      "border-b last:border-b-0",
                      isLong && "bg-yellow-50",
                    )}
                  >
                    <td className="px-2 py-1 font-mono text-xs">
                      {node.name}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1 text-right text-xs",
                        isLong ? "font-medium text-yellow-700" : "text-gray-600",
                      )}
                    >
                      {node.duration_ms >= 1000
                        ? `${(node.duration_ms / 1000).toFixed(1)}s`
                        : `${node.duration_ms}ms`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
