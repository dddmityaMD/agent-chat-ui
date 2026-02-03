"use client";

import React from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Match reason data from the backend.
 * Describes why a search result matched the query.
 */
export interface MatchReason {
  /** Fields where query terms were found (e.g., ["name", "description"]) */
  matchedFields: string[];
  /** Query terms that matched (e.g., ["revenue", "report"]) */
  matchedTerms: string[];
  /** Overall match confidence score (0.0-1.0) */
  confidence: number;
  /** Human-readable explanation */
  explanation?: string;
  /** Per-field confidence breakdown */
  fieldConfidences?: Record<string, number>;
  /** Whether this evidence was deduplicated */
  isDuplicate?: boolean;
}

export interface MatchReasonDisplayProps {
  /** Match reason data from backend */
  matchReason: MatchReason;
  /** Display variant: simple (inline text) or detailed (expandable card) */
  variant?: "simple" | "detailed";
  /** Whether to show confidence score in simple variant */
  showConfidence?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format field name for display (e.g., "table_name" -> "table name")
 */
function formatFieldName(field: string): string {
  return field.replace(/_/g, " ");
}

/**
 * Get confidence color based on score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600";
  if (confidence >= 0.5) return "text-yellow-600";
  return "text-gray-500";
}

/**
 * ProgressBar - Simple confidence visualization
 */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2" data-testid="confidence-bar">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            confidence >= 0.8
              ? "bg-green-500"
              : confidence >= 0.5
                ? "bg-yellow-500"
                : "bg-gray-400",
          )}
          style={{ width: `${percentage}%` }}
          data-confidence={percentage}
        />
      </div>
      <span className={cn("text-xs font-medium", getConfidenceColor(confidence))}>
        {percentage}%
      </span>
    </div>
  );
}

/**
 * Highlight matched terms in text
 */
function highlightTerms(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;

  // Create regex to match any of the terms (case-insensitive)
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark key={i} className="rounded bg-yellow-100 px-0.5 text-yellow-800">
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * Simple inline match reason display
 */
function SimpleMatchReason({
  matchReason,
  showConfidence,
  className,
}: Omit<MatchReasonDisplayProps, "variant">) {
  const { matchedTerms, matchedFields, confidence, explanation, isDuplicate } = matchReason;

  // Build explanation if not provided
  const displayText =
    explanation ||
    (matchedTerms.length > 0 && matchedFields.length > 0
      ? `Matched: ${matchedTerms.slice(0, 3).map((t) => `'${t}'`).join(", ")} in ${matchedFields.slice(0, 3).map(formatFieldName).join(", ")}`
      : "No match details");

  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5 text-sm",
        className,
      )}
      data-testid="match-reason-simple"
    >
      <span>{displayText}</span>
      {isDuplicate && (
        <span className="text-muted-foreground/70 text-xs">(reused)</span>
      )}
      {showConfidence && (
        <span className={cn("text-xs font-medium", getConfidenceColor(confidence))}>
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </span>
  );
}

/**
 * Detailed expandable match reason display
 */
function DetailedMatchReason({
  matchReason,
  className,
}: Omit<MatchReasonDisplayProps, "variant" | "showConfidence">) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { matchedTerms, matchedFields, confidence, fieldConfidences, isDuplicate, explanation } =
    matchReason;

  return (
    <div className={cn("rounded-lg border bg-white", className)} data-testid="match-reason-detailed">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50"
        type="button"
        data-testid="expand-details"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {explanation || `Matched in ${matchedFields.length} field${matchedFields.length !== 1 ? "s" : ""}`}
          </span>
          {isDuplicate && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              reused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBar confidence={confidence} />
          {isExpanded ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-3">
          {/* Matched terms */}
          <div className="mb-3">
            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Matched Terms
            </h4>
            <div className="flex flex-wrap gap-1">
              {matchedTerms.map((term) => (
                <span
                  key={term}
                  className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>

          {/* Field breakdown */}
          <div>
            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Field Breakdown
            </h4>
            <div className="space-y-1">
              {matchedFields.map((field) => {
                const fieldConf = fieldConfidences?.[field] ?? confidence;
                return (
                  <div key={field} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-green-500" />
                      <span>{formatFieldName(field)}</span>
                    </div>
                    <span className={cn("text-xs", getConfidenceColor(fieldConf))}>
                      {Math.round(fieldConf * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deduplication note */}
          {isDuplicate && (
            <div className="mt-3 rounded bg-gray-50 p-2 text-xs text-gray-600">
              This evidence was reused from a previous query with the same content.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MatchReasonDisplay - Displays why a search result matched the query.
 *
 * Supports two variants:
 * - simple: Inline text suitable for table cells or lists
 * - detailed: Expandable card with confidence breakdown
 *
 * @example
 * // Simple inline display
 * <MatchReasonDisplay
 *   matchReason={{ matchedTerms: ["revenue"], matchedFields: ["name"], confidence: 0.9 }}
 *   variant="simple"
 * />
 *
 * @example
 * // Detailed expandable display
 * <MatchReasonDisplay
 *   matchReason={{ matchedTerms: ["revenue"], matchedFields: ["name", "description"], confidence: 0.85, fieldConfidences: { name: 1.0, description: 0.7 } }}
 *   variant="detailed"
 * />
 */
export function MatchReasonDisplay({
  matchReason,
  variant = "simple",
  showConfidence = false,
  className,
}: MatchReasonDisplayProps) {
  if (variant === "detailed") {
    return <DetailedMatchReason matchReason={matchReason} className={className} />;
  }

  return (
    <SimpleMatchReason
      matchReason={matchReason}
      showConfidence={showConfidence}
      className={className}
    />
  );
}

// Export utility functions for use in other components
export { highlightTerms, formatFieldName, getConfidenceColor };

export default MatchReasonDisplay;
