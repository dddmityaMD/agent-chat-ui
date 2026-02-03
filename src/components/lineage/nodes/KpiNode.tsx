/**
 * Custom React Flow node for KPI metrics.
 * Orange target icon with label below.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Target } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function KpiNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-orange-400" />
      <Target className="h-5 w-5 text-orange-600" />
      <span className="max-w-[140px] truncate text-xs font-medium text-orange-900">
        {payload.label}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-orange-400" />
    </div>
  );
}

export const KpiNode = memo(KpiNodeComponent);
