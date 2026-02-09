"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Field-level match details
 */
export interface FieldMatchDetail {
  /** Field name that matched */
  field: string;
  /** Confidence score for this field (0.0-1.0) */
  confidence: number;
  /** Text snippet showing the match context */
  snippet?: string;
}

/**
 * Detailed match information for a search result
 */
export interface MatchDetails {
  /** Per-field match breakdown */
  matchedFields: FieldMatchDetail[];
  /** Overall confidence score */
  overallConfidence: number;
  /** Query terms that were searched */
  queryTerms: string[];
  /** Fields that almost matched but didn't meet threshold */
  alternativeMatches: string[];
  /** Whether this result was a deduplicated item */
  isDuplicate: boolean;
  /** Original evidence ID if deduplicated */
  originalId?: string;
}

interface UseSearchMatchDetailsReturn {
  /** Match details if loaded */
  details: MatchDetails | null;
  /** Loading state */
  loading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Fetch details for a result */
  fetchDetails: () => Promise<void>;
  /** Clear cached details */
  clearDetails: () => void;
}

// Simple in-memory cache for match details (bounded to prevent leaks)
const MAX_CACHE_SIZE = 200;
const detailsCache = new Map<string, { details: MatchDetails; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cached entry is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

/**
 * useSearchMatchDetails - Hook for fetching detailed match information.
 *
 * Fetches expanded match details for a search result, including
 * per-field confidence scores and match snippets.
 *
 * Features:
 * - Lazy loading (details fetched on demand)
 * - In-memory caching with 5-minute TTL
 * - Error handling and loading states
 *
 * @param resultId - The ID of the result to get details for
 * @param initialDetails - Optional initial details (from initial API response)
 *
 * @example
 * const { details, loading, fetchDetails } = useSearchMatchDetails("result-123");
 *
 * // Fetch on user interaction
 * <button onClick={fetchDetails}>Show details</button>
 *
 * // Display when loaded
 * {details && (
 *   <div>
 *     <p>Confidence: {details.overallConfidence}</p>
 *     {details.matchedFields.map(f => <p>{f.field}: {f.confidence}</p>)}
 *   </div>
 * )}
 */
export function useSearchMatchDetails(
  resultId: string,
  initialDetails?: MatchDetails,
): UseSearchMatchDetailsReturn {
  const [details, setDetails] = useState<MatchDetails | null>(() => {
    // Check cache first
    const cached = detailsCache.get(resultId);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.details;
    }
    return initialDetails ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we've already fetched to avoid duplicate requests
  const hasFetchedRef = useRef(false);

  const fetchDetails = useCallback(async () => {
    // Skip if already have details or currently loading
    if (details || loading || hasFetchedRef.current) {
      return;
    }

    // Check cache
    const cached = detailsCache.get(resultId);
    if (cached && isCacheValid(cached.timestamp)) {
      setDetails(cached.details);
      return;
    }

    setLoading(true);
    setError(null);
    hasFetchedRef.current = true;

    try {
      // Fetch from backend API
      const response = await fetch(`/api/evidence/${resultId}/match-details`);

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint not found — leave details null
          return;
        }
        throw new Error(`Failed to fetch match details: ${response.statusText}`);
      }

      const data = (await response.json()) as MatchDetails;
      setDetails(data);

      // Cache the result (evict oldest if at capacity)
      if (detailsCache.size >= MAX_CACHE_SIZE) {
        const oldest = detailsCache.keys().next().value;
        if (oldest !== undefined) detailsCache.delete(oldest);
      }
      detailsCache.set(resultId, { details: data, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [resultId, details, loading]);

  const clearDetails = useCallback(() => {
    setDetails(null);
    setError(null);
    hasFetchedRef.current = false;
    detailsCache.delete(resultId);
  }, [resultId]);

  return {
    details,
    loading,
    error,
    fetchDetails,
    clearDetails,
  };
}

/**
 * Clear all cached match details.
 * Useful when evidence data is refreshed.
 */
export function clearMatchDetailsCache(): void {
  detailsCache.clear();
}

export default useSearchMatchDetails;
