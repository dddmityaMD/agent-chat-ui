/**
 * Custom React Flow node for Metabase cards and dashboards.
 * Cards: purple with BarChart3 icon.
 * Dashboards: indigo with LayoutDashboard icon.
 */
import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { BarChart3, LayoutDashboard } from "lucide-react";
import type { LineageNodePayload } from "../utils/graph-transform";

function CardNodeComponent({ data }: NodeProps) {
  const payload = data as unknown as LineageNodePayload;
  const isDashboard = payload.backendType === "metabase.dashboard";

  const borderClass = isDashboard ? "border-indigo-200" : "border-purple-200";
  const bgClass = isDashboard ? "bg-indigo-50" : "bg-purple-50";
  const textClass = isDashboard ? "text-indigo-900" : "text-purple-900";
  const iconClass = isDashboard ? "text-indigo-600" : "text-purple-600";
  const handleClass = isDashboard ? "!bg-indigo-400" : "!bg-purple-400";
  const subtitleClass = isDashboard ? "text-indigo-500" : "text-purple-500";

  const Icon = isDashboard ? LayoutDashboard : BarChart3;
  const subtitle = isDashboard
    ? `${(payload.props?.cards_count as number) ?? 0} cards`
    : (payload.props?.display as string | undefined);

  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border ${borderClass} ${bgClass} px-3 py-2 shadow-sm`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Icon className={`h-5 w-5 ${iconClass}`} />
      <span className={`max-w-[140px] truncate text-xs font-medium ${textClass}`}>
        {payload.label}
      </span>
      {subtitle && (
        <span className={`text-[10px] ${subtitleClass}`}>{subtitle}</span>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

export const CardNode = memo(CardNodeComponent);
