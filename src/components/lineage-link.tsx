"use client";

import React, { useCallback } from "react";
import { GitBranch } from "lucide-react";

// ---------------------------------------------------------------------------
// Custom event for cross-component lineage navigation
// ---------------------------------------------------------------------------

/** Event detail payload for navigating to the Lineage tab with a filter. */
export interface LineageNavigateDetail {
  /** Canonical keys of grounded entities to filter by. */
  canonicalKeys: string[];
  /** Display names for filter chip UI. */
  displayNames: string[];
}

/** Event name used for lineage deep-link navigation. */
export const LINEAGE_NAVIGATE_EVENT = "sais:navigate-lineage";

/**
 * Dispatch a custom event to navigate the case panel to the Lineage tab
 * with a canonical key filter. This is consumed by CasePanel.
 */
export function navigateToLineage(
  canonicalKeys: string[],
  displayNames: string[],
): void {
  window.dispatchEvent(
    new CustomEvent<LineageNavigateDetail>(LINEAGE_NAVIGATE_EVENT, {
      detail: { canonicalKeys, displayNames },
    }),
  );
}

// ---------------------------------------------------------------------------
// ViewInLineageButton -- standalone button for AI messages with lineage content
// ---------------------------------------------------------------------------

interface ViewInLineageButtonProps {
  /** Grounded entities with canonical keys to filter by. */
  entities: Array<{ canonical_key: string; name: string }>;
}

/**
 * A small "View in Lineage" button that appears at the bottom of AI messages
 * when entities have been grounded (resolved to canonical keys).
 * Only shows for grounded entities — ungrounded entities must be
 * disambiguated first.
 */
export function ViewInLineageButton({ entities }: ViewInLineageButtonProps) {
  const handleClick = useCallback(() => {
    navigateToLineage(
      entities.map((e) => e.canonical_key),
      entities.map((e) => e.name),
    );
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
