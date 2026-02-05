/**
 * GroupNode - Custom React Flow group node for architecture layer zones.
 *
 * Renders a colored background rectangle with a label.
 * Defined outside component render to prevent React Flow re-renders.
 */
import React, { memo } from "react";
import type { NodeProps } from "@xyflow/react";

interface GroupNodeData {
  label: string;
  layer: string;
  bg: string;
  border: string;
  [key: string]: unknown;
}

function GroupNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as GroupNodeData;

  return (
    <div
      className="relative h-full w-full rounded-xl"
      style={{
        backgroundColor: payload.bg,
        border: `2px dashed ${payload.border}`,
        minHeight: 100,
        pointerEvents: "none",
      }}
    >
      <span
        className="absolute left-3 top-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: payload.border }}
      >
        {payload.label}
      </span>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
