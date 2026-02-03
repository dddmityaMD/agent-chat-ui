/**
 * Custom React Flow node for warehouse tables.
 * Blue database icon with label below.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Database } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function TableNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;
  const schema = payload.props?.schema as string | undefined;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-blue-400" />
      <Database className="h-5 w-5 text-blue-600" />
      <span className="max-w-[140px] truncate text-xs font-medium text-blue-900">
        {payload.label}
      </span>
      {schema && (
        <span className="text-[10px] text-blue-500">{schema}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-blue-400" />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
