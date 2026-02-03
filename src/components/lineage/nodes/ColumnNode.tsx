/**
 * Custom React Flow node for warehouse columns.
 * Gray columns icon with label below.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Columns3 } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function ColumnNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;
  const dataType = payload.props?.data_type as string | undefined;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <Columns3 className="h-5 w-5 text-gray-600" />
      <span className="max-w-[140px] truncate text-xs font-medium text-gray-900">
        {payload.label}
      </span>
      {dataType && (
        <span className="text-[10px] text-gray-500">{dataType}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}

export const ColumnNode = memo(ColumnNodeComponent);
