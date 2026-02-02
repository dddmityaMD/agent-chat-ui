"use client";

import React from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchReasonDisplay, type MatchReason } from "./MatchReasonDisplay";

/**
 * Result item for the transparency panel
 */
export interface SearchResultItem {
  /** Unique identifier for the result */
  id: string;
  /** Result name/title for display */
  name?: string;
  /** Match reason data */
  matchReason: MatchReason;
}

export interface SearchTransparencyPanelProps {
  /** The search query */
  query: string;
  /** Search results with match reasons */
  results: SearchResultItem[];
  /** Whether to show detailed view by default */
  showDetailsByDefault?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when a result is selected/clicked */
  onResultClick?: (resultId: string) => void;
}

/**
 * Single result row with expandable match details
 */
function ResultRow({
  result,
  isExpanded,
  onToggle,
  onClick,
}: {
  result: SearchResultItem;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between p-2 hover:bg-gray-50">
        <div className="min-w-0 flex-1">
          {result.name && (
            <button
              onClick={onClick}
              className="text-primary block truncate text-sm font-medium hover:underline"
              type="button"
            >
              {result.name}
            </button>
          )}
          {!isExpanded && (
            <MatchReasonDisplay
              matchReason={result.matchReason}
              variant="simple"
              className="mt-0.5"
            />
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:bg-muted ml-2 flex-shrink-0 rounded p-1 hover:text-gray-700"
          title={isExpanded ? "Hide details" : "Show details"}
          type="button"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
      {isExpanded && (
        <div className="bg-muted/30 px-2 pb-2">
          <MatchReasonDisplay matchReason={result.matchReason} variant="detailed" />
        </div>
      )}
    </div>
  );
}

/**
 * SearchTransparencyPanel - Displays search results with match transparency.
 *
 * Shows why each result matched the query with expandable details.
 * Supports both simple (default) and detailed views.
 *
 * Features:
 * - Header with query and result count
 * - Per-result expansion for detailed match info
 * - Global expand/collapse all toggle
 * - Smart defaults (simple view initially)
 *
 * @example
 * <SearchTransparencyPanel
 *   query="revenue report"
 *   results={[
 *     {
 *       id: "1",
 *       name: "Q4 Revenue Report",
 *       matchReason: {
 *         matchedTerms: ["revenue", "report"],
 *         matchedFields: ["name"],
 *         confidence: 1.0,
 *       }
 *     }
 *   ]}
 *   onResultClick={(id) => console.log("Selected:", id)}
 * />
 */
export function SearchTransparencyPanel({
  query,
  results,
  showDetailsByDefault = false,
  className,
  onResultClick,
}: SearchTransparencyPanelProps) {
  // Track expanded state for each result
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(showDetailsByDefault ? results.map((r) => r.id) : []),
  );

  // Track if all are expanded (for toggle button)
  const allExpanded = results.length > 0 && expandedIds.size === results.length;

  const toggleResult = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(results.map((r) => r.id)));
    }
  }, [allExpanded, results]);

  if (results.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-white p-4", className)}>
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <Search className="h-4 w-4" />
          <span>No results found for &quot;{query}&quot;</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-white", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground h-4 w-4" />
          <span className="text-sm">
            Found{" "}
            <span className="font-medium">{results.length}</span>{" "}
            result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              {query}
            </span>
          </span>
        </div>
        <button
          onClick={toggleAll}
          className="text-muted-foreground hover:bg-muted flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:text-gray-700"
          type="button"
        >
          {allExpanded ? (
            <>
              <EyeOff className="h-3 w-3" />
              Hide all details
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Show all details
            </>
          )}
        </button>
      </div>

      {/* Results list */}
      <div className="max-h-96 overflow-y-auto">
        {results.map((result) => (
          <ResultRow
            key={result.id}
            result={result}
            isExpanded={expandedIds.has(result.id)}
            onToggle={() => toggleResult(result.id)}
            onClick={onResultClick ? () => onResultClick(result.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default SearchTransparencyPanel;
