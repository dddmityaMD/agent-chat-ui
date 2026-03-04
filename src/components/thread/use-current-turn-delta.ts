/**
 * use-current-turn-delta.ts — Custom hook for filtering streaming state
 * by turn_id match with baseline-delta comparison.
 */

import { useRef } from "react";
import type { StreamingStateValues } from "@/lib/message-groups";

/**
 * Fields used for streaming stage details. Delta comparison is applied to
 * these to filter out stale checkpoint data from previous turns.
 */
const DETAIL_FIELDS = [
  "resolved_entities",
  "intent",
  "intent_confidence",
  "active_flow",
  "evidence_result",
  "findings",
  "sais_ui",
] as const;

/**
 * Gate streaming values by turn_id match, then apply baseline-delta comparison
 * to filter out stale checkpoint fields from previous turns.
 *
 * Two-layer filter:
 * 1. turn_id gate — before the backend stamps this turn's ID, show nothing
 * 2. baseline delta — when turn_id first matches, snapshot the (stale) checkpoint
 *    values; only show fields whose deep value changed since that snapshot
 */
export function useCurrentTurnDelta(
  streamValues: StreamingStateValues,
  currentTurnId: string | null,
): StreamingStateValues {
  const baselineRef = useRef<Record<string, string> | null>(null);
  const prevMatchRef = useRef(false);

  const matches = !!currentTurnId && streamValues.turn_id === currentTurnId;

  // On first turn_id match: snapshot stale checkpoint values as baseline
  if (matches && !prevMatchRef.current) {
    const snap: Record<string, string> = {};
    for (const f of DETAIL_FIELDS) {
      snap[f] = JSON.stringify(streamValues[f]);
    }
    baselineRef.current = snap;
  }

  // When turn ends (no match after previously matching): clear baseline
  if (!matches && prevMatchRef.current) {
    baselineRef.current = null;
  }

  prevMatchRef.current = matches;

  // Before turn_id matches: nothing to show
  if (!matches) return {};

  // No baseline (first turn, no stale data): return all values
  if (!baselineRef.current) return streamValues;

  // Delta: only include fields whose deep value changed since baseline
  const baseline = baselineRef.current;
  const delta: StreamingStateValues = {};

  for (const f of DETAIL_FIELDS) {
    if (JSON.stringify(streamValues[f]) !== baseline[f]) {
      (delta as Record<string, unknown>)[f] = streamValues[f];
    }
  }

  return delta;
}
