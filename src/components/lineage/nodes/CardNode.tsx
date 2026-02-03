/**
 * Custom React Flow node for Metabase cards/reports.
 * Purple chart icon with label below.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { BarChart3 } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function CardNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;
  const collection = payload.props?.collection as string | undefined;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-purple-400" />
      <BarChart3 className="h-5 w-5 text-purple-600" />
      <span className="max-w-[140px] truncate text-xs font-medium text-purple-900">
        {payload.label}
      </span>
      {collection && (
        <span className="text-[10px] text-purple-500">{collection}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-purple-400" />
    </div>
  );
}

export const CardNode = memo(CardNodeComponent);
