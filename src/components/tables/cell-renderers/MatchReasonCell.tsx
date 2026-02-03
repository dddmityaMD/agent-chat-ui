"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MatchReasonDisplay,
  type MatchReason,
} from "@/components/search/MatchReasonDisplay";
import {
  DeduplicationIndicator,
  isDebugMode,
} from "@/components/evidence/DeduplicationIndicator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Expected row data structure for match reason cell
 */
export interface MatchReasonRowData {
  /** Match reason data from backend */
  match_reason?: {
    matchedFields?: string[];
    matched_fields?: string[];
    matchedTerms?: string[];
    matched_terms?: string[];
    confidence?: number;
    explanation?: string;
    fieldConfidences?: Record<string, number>;
    field_confidences?: Record<string, number>;
  };
  /** Whether this row is a deduplicated evidence item */
  is_duplicate?: boolean;
  /** Content hash for deduplication (debug only) */
  content_hash?: string;
  /** Alternative field name for relevance score display */
  relevance_score?: number;
}

export interface MatchReasonCellProps {
  /** Cell renderer params from AG Grid */
  params?: ICellRendererParams;
  /** Direct match reason data (when not using AG Grid) */
  matchReason?: MatchReason;
  /** Whether to show expandable details */
  expandable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Normalize backend snake_case to frontend camelCase
 */
function normalizeMatchReason(data: MatchReasonRowData["match_reason"]): MatchReason | null {
  if (!data) return null;

  return {
    matchedFields: data.matchedFields ?? data.matched_fields ?? [],
    matchedTerms: data.matchedTerms ?? data.matched_terms ?? [],
    confidence: data.confidence ?? 0,
    explanation: data.explanation,
    fieldConfidences: data.fieldConfidences ?? data.field_confidences,
  };
}

/**
 * Simple inline display (no expansion)
 */
function SimpleMatchReasonCell({
  matchReason,
  isDuplicate,
  contentHash,
  displayValue,
}: {
  matchReason: MatchReason | null;
  isDuplicate: boolean;
  contentHash?: string;
  displayValue: string;
}) {
  const showDebug = isDebugMode();

  return (
    <span className="flex items-center gap-1.5" data-testid="match-reason-cell">
      {/* Main display value (usually relevance score) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "cursor-help truncate",
              matchReason && "border-muted-foreground border-b border-dotted",
            )}
          >
            {displayValue}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {matchReason ? (
            <div className="max-w-xs">
              <p className="font-medium">{matchReason.explanation || "Match details"}</p>
              {matchReason.matchedTerms.length > 0 && (
                <p className="text-xs">
                  Terms: {matchReason.matchedTerms.join(", ")}
                </p>
              )}
              {matchReason.matchedFields.length > 0 && (
                <p className="text-xs">
                  Fields: {matchReason.matchedFields.join(", ")}
                </p>
              )}
              <p className="text-xs">
                Confidence: {Math.round((matchReason.confidence ?? 0) * 100)}%
              </p>
            </div>
          ) : (
            <span>No match reason provided</span>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Deduplication indicator */}
      {isDuplicate && (
        <DeduplicationIndicator
          isDuplicate={true}
          contentHash={contentHash}
          showHash={showDebug}
        />
      )}
    </span>
  );
}

/**
 * Expandable match reason cell with detailed view
 */
function ExpandableMatchReasonCell({
  matchReason,
  isDuplicate,
  contentHash,
  displayValue,
}: {
  matchReason: MatchReason;
  isDuplicate: boolean;
  contentHash?: string;
  displayValue: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const showDebug = isDebugMode();

  return (
    <div className="py-1" data-testid="match-reason-cell">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
        type="button"
        data-testid="expand-match-details"
      >
        <span className="flex items-center gap-1.5">
          <span className="border-muted-foreground cursor-pointer border-b border-dotted">
            {displayValue}
          </span>
          {isDuplicate && (
            <DeduplicationIndicator
              isDuplicate={true}
              contentHash={contentHash}
              showHash={showDebug}
            />
          )}
        </span>
        {isExpanded ? (
          <ChevronUp className="text-muted-foreground h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground h-3 w-3 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-1">
          <MatchReasonDisplay
            matchReason={matchReason}
            variant="detailed"
            className="text-xs"
          />
        </div>
      )}
    </div>
  );
}

/**
 * MatchReasonCell - AG Grid cell renderer for match reasons.
 *
 * Displays relevance score with match reason tooltip/expansion.
 * Includes deduplication indicator when evidence was reused.
 *
 * Features:
 * - Shows relevance score as primary value
 * - Tooltip with match reason explanation
 * - Optional expandable detailed view
 * - Deduplication indicator with debug hash
 *
 * Expected row data fields:
 * - match_reason: MatchReason object (snake_case from backend)
 * - is_duplicate: boolean
 * - content_hash: string (debug only)
 * - relevance_score: number (alternative primary value)
 *
 * @example
 * // In column definition
 * {
 *   field: 'relevance_score',
 *   headerName: 'Relevance',
 *   cellRenderer: MatchReasonCell,
 * }
 */
export function MatchReasonCell(
  params: ICellRendererParams | MatchReasonCellProps,
): React.ReactElement | null {
  // Handle both AG Grid params and direct props
  let matchReason: MatchReason | null = null;
  let isDuplicate = false;
  let contentHash: string | undefined;
  let displayValue = "N/A";
  let expandable = false;

  if ("data" in params && params.data) {
    // AG Grid mode
    const data = params.data as MatchReasonRowData;
    matchReason = normalizeMatchReason(data.match_reason);
    isDuplicate = data.is_duplicate ?? false;
    contentHash = data.content_hash;
    displayValue = params.value != null ? String(params.value) : "N/A";

    // Check for expandable flag in colDef
    const colDef = params.colDef as { cellRendererParams?: { expandable?: boolean } };
    expandable = colDef?.cellRendererParams?.expandable ?? false;
  } else if ("matchReason" in params && params.matchReason) {
    // Direct props mode
    matchReason = params.matchReason;
    expandable = params.expandable ?? false;
    displayValue = matchReason.confidence
      ? `${Math.round(matchReason.confidence * 100)}%`
      : "N/A";
  }

  // Use expandable view if enabled and we have match reason data
  if (expandable && matchReason) {
    return (
      <ExpandableMatchReasonCell
        matchReason={matchReason}
        isDuplicate={isDuplicate}
        contentHash={contentHash}
        displayValue={displayValue}
      />
    );
  }

  // Default: simple inline display
  return (
    <SimpleMatchReasonCell
      matchReason={matchReason}
      isDuplicate={isDuplicate}
      contentHash={contentHash}
      displayValue={displayValue}
    />
  );
}

export default MatchReasonCell;
