/**
 * Custom React Flow node for dbt models and sources.
 * Green cog icon with label below.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Cog } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function DbtModelNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;
  const schema = payload.props?.schema as string | undefined;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-green-400" />
      <Cog className="h-5 w-5 text-green-600" />
      <span className="max-w-[140px] truncate text-xs font-medium text-green-900">
        {payload.label}
      </span>
      {schema && (
        <span className="text-[10px] text-green-500">{schema}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-green-400" />
    </div>
  );
}

export const DbtModelNode = memo(DbtModelNodeComponent);
