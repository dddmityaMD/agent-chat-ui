'use client';

import { Search, Database, BarChart3, GitBranch, Check } from 'lucide-react';
import type { PendingDisambiguation, DisambiguationCandidate } from '@/lib/types';
import type { Message } from '@langchain/langgraph-sdk';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Selection detection
// ---------------------------------------------------------------------------

/**
 * Determine which candidate was selected by examining the next human message.
 *
 * The disambiguation flow sends a human message with:
 * - Text like "Show details for orders" or "None of these match what I meant"
 * - Optional entity_selection content block with node_id
 *
 * Returns the node_id of the selected candidate, or "skip" if user skipped,
 * or null if no selection can be determined.
 */
export function detectSelection(
  candidates: DisambiguationCandidate[],
  nextHumanMessage?: Message,
): string | null {
  if (!nextHumanMessage) return null;

  const content = nextHumanMessage.content;

  // Check for entity_selection content block (most reliable)
  if (Array.isArray(content)) {
    const entityBlock = content.find(
      (c: Record<string, unknown>) => c.type === 'entity_selection',
    ) as { node_id?: string } | undefined;
    if (entityBlock?.node_id) return entityBlock.node_id;

    // Check text for skip
    const textBlocks = content
      .filter((c: Record<string, unknown>) => c.type === 'text')
      .map((c: Record<string, unknown>) => (c as { text: string }).text || '');
    const text = textBlocks.join(' ').toLowerCase();
    if (text.includes('none of these') || text.includes('skip')) return 'skip';

    // Try to match text against candidate names
    for (const candidate of candidates) {
      if (text.includes(candidate.name.toLowerCase())) {
        return candidate.node_id;
      }
    }
  } else if (typeof content === 'string') {
    const text = content.toLowerCase();
    if (text.includes('none of these') || text.includes('skip')) return 'skip';
    for (const candidate of candidates) {
      if (text.includes(candidate.name.toLowerCase())) {
        return candidate.node_id;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers (copied from disambiguation-card.tsx, adapted for readonly)
// ---------------------------------------------------------------------------

function getTypeBadgeClass(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et.includes('table') || et.includes('column')) {
    return 'bg-emerald-100/60 text-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-300/70';
  }
  if (et.includes('report') || et.includes('card') || et.includes('dashboard')) {
    return 'bg-blue-100/60 text-blue-700/70 dark:bg-blue-900/40 dark:text-blue-300/70';
  }
  if (et.includes('dbt')) {
    return 'bg-orange-100/60 text-orange-700/70 dark:bg-orange-900/40 dark:text-orange-300/70';
  }
  return 'bg-gray-100/60 text-gray-700/70 dark:bg-gray-800/40 dark:text-gray-300/70';
}

function getIconForType(entityType: string): typeof Search {
  const et = entityType.toLowerCase();
  if (et.includes('table') || et.includes('column')) return Database;
  if (et.includes('report') || et.includes('card') || et.includes('dashboard')) return BarChart3;
  if (et.includes('dbt')) return GitBranch;
  return Search;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HistoricalDisambiguationCardProps {
  payload: PendingDisambiguation;
  /** The next human message (used to detect which option was selected) */
  nextHumanMessage?: Message;
}

/**
 * Read-only, grayed-out version of DisambiguationCard for historical messages.
 * Shows all candidates but highlights the one that was selected.
 *
 * Design decisions (UAT-4):
 * - Historical disambiguation cards stay visible (grayed out)
 * - The chosen option is highlighted with a green check
 * - Non-interactive (no click handlers)
 */
export function HistoricalDisambiguationCard({
  payload,
  nextHumanMessage,
}: HistoricalDisambiguationCardProps) {
  const candidates = payload.candidates.slice(0, 4);
  const selectedNodeId = detectSelection(candidates, nextHumanMessage);
  const wasSkipped = selectedNodeId === 'skip';

  return (
    <div
      data-testid="historical-disambiguation-card"
      className="my-2 rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
    >
      <p className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
        {payload.mention
          ? `Multiple matches found for "${payload.mention}"`
          : 'Multiple matches found'}
      </p>

      <div className="space-y-2">
        {candidates.map((candidate: DisambiguationCandidate, idx: number) => {
          const isSelected = selectedNodeId === candidate.node_id;
          const Icon = getIconForType(candidate.entity_type);
          const typeBadgeClass = getTypeBadgeClass(candidate.entity_type);

          return (
            <div
              key={candidate.node_id || `candidate-${idx}`}
              className={cn(
                'rounded-md border p-3 transition-colors',
                isSelected
                  ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40'
                  : 'border-gray-200 bg-white/50 dark:border-gray-700 dark:bg-gray-800/30',
              )}
              data-testid="historical-disambiguation-candidate"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span
                      className={cn(
                        'font-medium',
                        isSelected
                          ? 'text-emerald-800 dark:text-emerald-200'
                          : 'text-gray-500 dark:text-gray-400',
                      )}
                    >
                      {candidate.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeClass}`}
                    >
                      {candidate.entity_type}
                    </span>
                  </div>
                  {candidate.location && (
                    <p className="mt-0.5 ml-5.5 text-xs text-gray-400 dark:text-gray-500">
                      {candidate.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {candidate.similarity > 0 && (
                    <span className="whitespace-nowrap text-xs text-gray-400/70 dark:text-gray-500/70">
                      {(candidate.similarity * 100).toFixed(0)}%
                    </span>
                  )}
                  {isSelected && (
                    <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 dark:bg-emerald-900/60">
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        Selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Skip indicator */}
        {wasSkipped && (
          <div className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-gray-100/50 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
            <Check className="h-3 w-3 text-gray-400" />
            Skipped — none of these matched
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoricalDisambiguationCard;
