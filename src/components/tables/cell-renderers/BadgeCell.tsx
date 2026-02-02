"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import { cn } from "@/lib/utils";

/**
 * Semantic color mapping for status badges.
 * Colors follow CONTEXT.md specifications:
 * - Green: success/active/published
 * - Red: error/failed
 * - Blue: running
 * - Gray: pending/draft
 * - Yellow: deprecated/warning
 */
const statusColorMap: Record<string, string> = {
  // Success states (Green)
  success: "bg-green-100 text-green-800 border-green-200",
  active: "bg-green-100 text-green-800 border-green-200",
  published: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  enabled: "bg-green-100 text-green-800 border-green-200",
  healthy: "bg-green-100 text-green-800 border-green-200",
  connected: "bg-green-100 text-green-800 border-green-200",

  // Error states (Red)
  error: "bg-red-100 text-red-800 border-red-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  critical: "bg-red-100 text-red-800 border-red-200",
  disconnected: "bg-red-100 text-red-800 border-red-200",
  unhealthy: "bg-red-100 text-red-800 border-red-200",

  // Running states (Blue)
  running: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  syncing: "bg-blue-100 text-blue-800 border-blue-200",

  // Pending states (Gray)
  pending: "bg-gray-100 text-gray-800 border-gray-200",
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  queued: "bg-gray-100 text-gray-800 border-gray-200",
  idle: "bg-gray-100 text-gray-800 border-gray-200",
  disabled: "bg-gray-100 text-gray-800 border-gray-200",
  archived: "bg-gray-100 text-gray-800 border-gray-200",

  // Warning states (Yellow)
  deprecated: "bg-yellow-100 text-yellow-800 border-yellow-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  stale: "bg-yellow-100 text-yellow-800 border-yellow-200",
  outdated: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

/**
 * Default color for unknown status values
 */
const defaultColor = "bg-gray-100 text-gray-800 border-gray-200";

export interface BadgeCellProps {
  value: string;
  className?: string;
}

/**
 * Get the Tailwind classes for a given status value.
 * Case-insensitive matching with underscore/hyphen normalization.
 */
export function getStatusColor(status: string): string {
  const normalized = status.toLowerCase().replace(/-/g, "_");
  return statusColorMap[normalized] || defaultColor;
}

/**
 * BadgeCell - Renders a status badge with semantic colors.
 *
 * Works with AG Grid ICellRendererParams or direct props.
 * Displays status as a rounded pill badge with appropriate color coding.
 */
export function BadgeCell(
  params: ICellRendererParams | BadgeCellProps,
): React.ReactElement | null {
  // Handle both AG Grid params and direct props
  const value = "value" in params ? params.value : null;
  const className = "className" in params ? params.className : undefined;

  if (value === null || value === undefined) {
    return null;
  }

  const statusText = String(value);
  const colorClasses = getStatusColor(statusText);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClasses,
        className,
      )}
    >
      {statusText}
    </span>
  );
}

export default BadgeCell;
