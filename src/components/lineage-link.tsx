"use client";

import React, { useCallback } from "react";
import { GitBranch } from "lucide-react";

// ---------------------------------------------------------------------------
// Custom event for cross-component lineage navigation
// ---------------------------------------------------------------------------

/** Event detail payload for navigating to the Lineage tab with a filter. */
export interface LineageNavigateDetail {
  entities: string[];
}

/** Event name used for lineage deep-link navigation. */
export const LINEAGE_NAVIGATE_EVENT = "sais:navigate-lineage";

/**
 * Dispatch a custom event to navigate the case panel to the Lineage tab
 * with an optional entity filter. This is consumed by CasePanel.
 */
export function navigateToLineage(entities: string[]): void {
  window.dispatchEvent(
    new CustomEvent<LineageNavigateDetail>(LINEAGE_NAVIGATE_EVENT, {
      detail: { entities },
    }),
  );
}

// ---------------------------------------------------------------------------
// LineageLink -- inline clickable component for lineage sections in AI messages
// ---------------------------------------------------------------------------

interface LineageLinkProps {
  /** Entity names to filter by when opening the Lineage tab. */
  entities: string[];
  children: React.ReactNode;
}

/**
 * Clickable inline element that opens the case panel's Lineage tab
 * pre-filtered to the specified entities.
 *
 * Used inside AI message rendering to make lineage-related content
 * actionable. Dispatches a custom event consumed by CasePanel.
 */
export function LineageLink({ entities, children }: LineageLinkProps) {
  const handleClick = useCallback(() => {
    navigateToLineage(entities);
  }, [entities]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-blue-600 underline decoration-blue-300 underline-offset-2 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
      title={`View lineage for: ${entities.join(", ")}`}
      data-testid="lineage-link"
    >
      <GitBranch className="inline h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ViewInLineageButton -- standalone button for AI messages with lineage content
// ---------------------------------------------------------------------------

interface ViewInLineageButtonProps {
  /** Entity names extracted from the message content. */
  entities: string[];
}

/**
 * A small "View in Lineage" button that appears at the bottom of AI messages
 * containing lineage-related content. Extracts entity names and opens the
 * Lineage tab filtered to those entities.
 */
export function ViewInLineageButton({ entities }: ViewInLineageButtonProps) {
  const handleClick = useCallback(() => {
    navigateToLineage(entities);
  }, [entities]);

  if (entities.length === 0) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
      data-testid="view-in-lineage-button"
    >
      <GitBranch className="h-3.5 w-3.5" />
      View in Lineage
      <span className="text-blue-500 dark:text-blue-400">
        ({entities.length} {entities.length === 1 ? "entity" : "entities"})
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Utility: Extract entity names from message content
// ---------------------------------------------------------------------------

/**
 * Extract potential entity names from AI message text that discusses lineage.
 *
 * Looks for:
 * - Table names in backticks (e.g., `schema.table_name`)
 * - Explicit mentions after "upstream"/"downstream" keywords
 * - Names in markdown bold that follow lineage patterns
 *
 * Returns deduplicated entity names, or empty array if no lineage content found.
 */
export function extractLineageEntities(content: string): string[] {
  const entities = new Set<string>();

  // Check if content discusses lineage at all
  const lineageKeywords = /\b(lineage|upstream|downstream|depends\s+on|dependen(?:t|cy|cies)|feeds?\s+into|sources?\s+from)\b/i;
  if (!lineageKeywords.test(content)) return [];

  // Extract backtick-quoted names that look like table/model references
  const backtickPattern = /`([a-zA-Z_][a-zA-Z0-9_.]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickPattern.exec(content)) !== null) {
    entities.add(match[1]);
  }

  // Extract backtick-quoted single names near lineage keywords (within ~200 chars)
  const lineageContextPattern = /(?:lineage|upstream|downstream|depends\s+on|dependen(?:t|cy|cies)|feeds?\s+into|sources?\s+from)[^`]{0,200}`([a-zA-Z_][a-zA-Z0-9_]*)`/gi;
  while ((match = lineageContextPattern.exec(content)) !== null) {
    entities.add(match[1]);
  }

  // Extract bold names near lineage keywords
  const boldPattern = /(?:lineage|upstream|downstream|depends\s+on|dependen(?:t|cy|cies))[^*]{0,200}\*\*([a-zA-Z_][a-zA-Z0-9_.]*)\*\*/gi;
  while ((match = boldPattern.exec(content)) !== null) {
    entities.add(match[1]);
  }

  return Array.from(entities);
}
