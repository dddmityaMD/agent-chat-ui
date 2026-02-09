"use client";

/**
 * Entity Candidates - Entity resolution results display.
 *
 * Shows selected entity highlighted, alternative candidates with
 * similarity scores, entity type badges, and canonical keys.
 * Stub -- will be implemented in Task 2.
 */

interface EntityCandidatesProps {
  entityCandidates: Array<{
    node_id: string;
    canonical_key: string;
    name: string;
    entity_type: string;
    score: number;
    selected: boolean;
  }>;
  focusEntities: Array<Record<string, unknown>>;
  resolvedEntities: Record<string, unknown>;
}

export function EntityCandidates(_props: EntityCandidatesProps) {
  return null;
}
