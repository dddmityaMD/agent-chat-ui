"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Format options for timestamp display
 */
export type TimestampFormat = "short" | "long" | "relative";

export interface TimestampCellProps {
  value: string | Date | number | null | undefined;
  format?: TimestampFormat;
  className?: string;
}

/**
 * Date format patterns for date-fns
 */
const formatPatterns = {
  short: "MMM d, yyyy, h:mm a", // "Jan 15, 2024, 2:30 PM"
  long: "MMMM d, yyyy 'at' h:mm:ss a", // "January 15, 2024 at 2:30:45 PM"
};

/**
 * Parse a value into a Date object.
 * Handles string (ISO), Date, and numeric (epoch ms) inputs.
 */
function parseDate(value: string | Date | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return isValid(date) ? date : null;
  }

  if (typeof value === "string") {
    // Try ISO parse first
    const isoDate = parseISO(value);
    if (isValid(isoDate)) {
      return isoDate;
    }

    // Fallback to Date constructor
    const fallbackDate = new Date(value);
    return isValid(fallbackDate) ? fallbackDate : null;
  }

  return null;
}

/**
 * Format a date according to the specified format type.
 */
function formatTimestamp(date: Date, formatType: TimestampFormat): string {
  if (formatType === "relative") {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return format(date, formatPatterns[formatType]);
}

/**
 * TimestampCell - Renders a formatted timestamp with ISO tooltip.
 *
 * Works with AG Grid ICellRendererParams or direct props.
 * - Default format: "Jan 15, 2024, 2:30 PM"
 * - Long format: "January 15, 2024 at 2:30:45 PM"
 * - Relative format: "2 hours ago"
 * - Tooltip shows full ISO 8601 timestamp
 */
export function TimestampCell(
  params: ICellRendererParams | TimestampCellProps,
): React.ReactElement | null {
  // Extract value and format from either AG Grid params or direct props
  const value = "value" in params ? params.value : null;
  const formatType: TimestampFormat =
    "format" in params && params.format ? params.format : "short";
  const className = "className" in params ? params.className : undefined;

  if (value === null || value === undefined) {
    return null;
  }

  const date = parseDate(value);

  // Handle invalid dates
  if (!date) {
    return (
      <span className="text-muted-foreground">
        {typeof value === "string" ? value : "Invalid date"}
      </span>
    );
  }

  const formattedDate = formatTimestamp(date, formatType);
  const isoTimestamp = date.toISOString();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            className || "text-muted-foreground cursor-help"
          }
          data-testid="timestamp-cell"
        >
          {formattedDate}
        </span>
      </TooltipTrigger>
      <TooltipContent data-testid="timestamp-tooltip">
        <span className="font-mono text-xs">{isoTimestamp}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export default TimestampCell;
