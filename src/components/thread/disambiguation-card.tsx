'use client';

import { Search, Database, BarChart3, GitBranch, ArrowRight } from 'lucide-react';
import type { PendingDisambiguation, DisambiguationCandidate } from '@/lib/types';

// --- Helpers ---

/**
 * Extract pending_disambiguation from sais_ui.
 * Returns null if absent or malformed.
 */
export function getPendingDisambiguation(saisUi?: unknown): PendingDisambiguation | null {
  if (!saisUi || typeof saisUi !== 'object') return null;
  const obj = saisUi as Record<string, unknown>;
  const pd = obj.pending_disambiguation;
  if (!pd || typeof pd !== 'object') return null;
  const p = pd as Record<string, unknown>;
  if (!Array.isArray(p.candidates) || p.candidates.length === 0) return null;
  // Validate candidates have required fields
  const validCandidates = p.candidates.every(
    (c: unknown) =>
      c &&
      typeof c === 'object' &&
      typeof (c as Record<string, unknown>).name === 'string' &&
      typeof (c as Record<string, unknown>).entity_type === 'string',
  );
  if (!validCandidates) return null;
  return {
    type: 'pending_disambiguation',
    mention: typeof p.mention === 'string' ? p.mention : '',
    candidates: p.candidates as PendingDisambiguation['candidates'],
    skip_option: typeof p.skip_option === 'string' ? p.skip_option : undefined,
    vague_detected: p.vague_detected === true,
    note: typeof p.note === 'string' ? p.note : undefined,
  };
}

/** Derive suggested actions based on entity type. */
function getActionsForType(entityType: string): { label: string; verb: string; icon: typeof Search }[] {
  const et = entityType.toLowerCase();
  if (et.includes('table') || et.includes('column') || et === 'warehouse.table' || et === 'warehouse.column') {
    return [
      { label: 'Show details', verb: 'Show details for', icon: Search },
      { label: 'Investigate', verb: 'Investigate', icon: Database },
    ];
  }
  if (et.includes('report') || et.includes('card') || et.includes('dashboard') || et === 'metabase.card' || et === 'metabase.dashboard') {
    return [
      { label: 'Show details', verb: 'Show details for', icon: Search },
      { label: 'Check freshness', verb: 'Check freshness of', icon: BarChart3 },
    ];
  }
  if (et.includes('dbt') || et === 'dbt.model') {
    return [
      { label: 'Show details', verb: 'Show details for', icon: Search },
      { label: 'Show lineage', verb: 'Show lineage for', icon: GitBranch },
    ];
  }
  // Default fallback
  return [{ label: 'Show details', verb: 'Show details for', icon: Search }];
}

/** Entity type badge color */
function getTypeBadgeClass(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et.includes('table') || et.includes('column')) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
  }
  if (et.includes('report') || et.includes('card') || et.includes('dashboard')) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  }
  if (et.includes('dbt')) {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

// --- Props ---

interface DisambiguationCardProps {
  payload: PendingDisambiguation;
  onSelect: (entityName: string, action: string) => void;
}

// --- Component ---

/**
 * DisambiguationCard shows entity disambiguation options to the user.
 *
 * Per CONTEXT.md: up to 4 clickable answers + skip option.
 * Each candidate shows name, type badge, location, match_reason,
 * and entity-type-specific actions (Show details, Investigate, etc.).
 */
export function DisambiguationCard({ payload, onSelect }: DisambiguationCardProps) {
  // Slice to first 4 candidates per CONTEXT.md
  const candidates = payload.candidates.slice(0, 4);
  const skipText = payload.skip_option || 'None of these match what I meant';

  return (
    <div
      data-testid="disambiguation-card"
      className="my-2 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
    >
      <p className="mb-3 text-sm font-medium text-blue-900 dark:text-blue-100">
        {payload.mention
          ? `Multiple matches found for "${payload.mention}". Which one did you mean?`
          : 'Multiple matches found. Which one did you mean?'}
      </p>

      {payload.note && (
        <p className="mb-3 text-xs text-blue-600 dark:text-blue-400">{payload.note}</p>
      )}

      <div className="space-y-2">
        {candidates.map((candidate: DisambiguationCandidate, idx: number) => {
          const actions = getActionsForType(candidate.entity_type);
          const typeBadgeClass = getTypeBadgeClass(candidate.entity_type);

          return (
            <div
              key={candidate.node_id || `candidate-${idx}`}
              className="rounded-md border border-blue-200 bg-white p-3 dark:border-blue-700 dark:bg-blue-900"
              data-testid="disambiguation-candidate"
            >
              {/* Candidate info */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {candidate.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeClass}`}
                    >
                      {candidate.entity_type}
                    </span>
                  </div>
                  {candidate.location && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {candidate.location}
                    </p>
                  )}
                  {candidate.match_reason && (
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {candidate.match_reason}
                    </p>
                  )}
                </div>
                {candidate.similarity > 0 && (
                  <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
                    {(candidate.similarity * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-1.5">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => onSelect(candidate.name, `${action.verb} ${candidate.name}`)}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700"
                      data-testid="disambiguation-action"
                    >
                      <Icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Skip option */}
        <button
          type="button"
          onClick={() => onSelect('', 'skip')}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-blue-300 bg-white px-3 py-2 text-xs text-blue-500 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-400 dark:hover:bg-blue-800"
          data-testid="disambiguation-skip"
        >
          <ArrowRight className="h-3 w-3" />
          {skipText}
        </button>
      </div>
    </div>
  );
}

export default DisambiguationCard;
