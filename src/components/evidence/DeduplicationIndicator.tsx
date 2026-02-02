"use client";

import React from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface DeduplicationIndicatorProps {
  /** Whether this evidence was deduplicated (reused from previous query) */
  isDuplicate: boolean;
  /** Original evidence ID if this is a duplicate */
  originalId?: string;
  /** Content hash for debugging (only shown in debug mode) */
  contentHash?: string;
  /** Whether to show the content hash (debug mode only) */
  showHash?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Truncate hash to first 8 characters for display
 */
function truncateHash(hash: string): string {
  return hash.slice(0, 8);
}

/**
 * DeduplicationIndicator - Shows when evidence was reused from a previous query.
 *
 * Displays a subtle icon when evidence is deduplicated. In debug mode,
 * also shows the content hash (truncated to 8 chars).
 *
 * Debug mode is enabled when:
 * - NODE_ENV is 'development'
 * - OR localStorage has debug=true
 *
 * Per CONTEXT.md: Content hash is NEVER visible to end users in production.
 *
 * @example
 * // Simple indicator
 * <DeduplicationIndicator isDuplicate={true} />
 *
 * @example
 * // With debug hash
 * <DeduplicationIndicator
 *   isDuplicate={true}
 *   contentHash="abc123def456..."
 *   showHash={process.env.NODE_ENV === 'development'}
 * />
 */
export function DeduplicationIndicator({
  isDuplicate,
  originalId,
  contentHash,
  showHash = false,
  className,
}: DeduplicationIndicatorProps) {
  // Don't render anything if not a duplicate
  if (!isDuplicate) {
    return null;
  }

  const tooltipContent = (
    <div className="max-w-xs">
      <p className="font-medium">Reused Evidence</p>
      <p className="text-muted-foreground text-xs">
        This evidence was reused from a previous query with identical content.
      </p>
      {originalId && (
        <p className="mt-1 text-xs">
          Original ID:{" "}
          <code className="bg-muted rounded px-1">{originalId}</code>
        </p>
      )}
      {showHash && contentHash && (
        <p className="mt-1 text-xs">
          Hash:{" "}
          <code className="bg-muted rounded px-1">{truncateHash(contentHash)}</code>
        </p>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "text-muted-foreground hover:text-muted-foreground/80 inline-flex cursor-help items-center gap-1",
            className,
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          {showHash && contentHash && (
            <code className="text-muted-foreground/70 text-[10px]">
              {truncateHash(contentHash)}
            </code>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Detect if we're in debug mode.
 * - Development environment
 * - OR localStorage debug flag
 */
export function isDebugMode(): boolean {
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "development";
  }
  return (
    process.env.NODE_ENV === "development" ||
    localStorage.getItem("debug") === "true"
  );
}

export default DeduplicationIndicator;
