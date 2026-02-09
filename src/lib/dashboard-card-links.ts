"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Dashboard-card relationship data for badge display.
 */
export interface DashboardCardRelation {
  id: string;
  name: string;
  type: "card" | "dashboard";
}

import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Fetch cards contained in a dashboard.
 *
 * @param dashboardId - The Metabase dashboard ID
 * @returns List of cards in the dashboard
 */
export async function fetchDashboardCards(
  dashboardId: string,
): Promise<DashboardCardRelation[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/dashboards/${dashboardId}/cards`);

    if (!res.ok) {
      if (res.status === 404) {
        return [];
      }
      console.error(
        `Failed to fetch dashboard cards: ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as DashboardCardRelation[];
    return data;
  } catch (error) {
    console.error("Error fetching dashboard cards:", error);
    return [];
  }
}

/**
 * Fetch dashboards containing a card.
 *
 * @param cardId - The Metabase card ID
 * @returns List of parent dashboards
 */
export async function fetchCardDashboards(
  cardId: string,
): Promise<DashboardCardRelation[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/cards/${cardId}/dashboards`);

    if (!res.ok) {
      if (res.status === 404) {
        return [];
      }
      console.error(
        `Failed to fetch card dashboards: ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as DashboardCardRelation[];
    return data;
  } catch (error) {
    console.error("Error fetching card dashboards:", error);
    return [];
  }
}

/**
 * Simple in-memory cache for relationship data.
 * TTL: 5 minutes (300000ms)
 */
const MAX_CACHE_SIZE = 200;
const relationCache = new Map<
  string,
  { data: DashboardCardRelation[]; timestamp: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedData(
  key: string,
): { data: DashboardCardRelation[]; hit: boolean } {
  const cached = relationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { data: cached.data, hit: true };
  }
  return { data: [], hit: false };
}

function setCachedData(key: string, data: DashboardCardRelation[]): void {
  if (relationCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldest = relationCache.keys().next().value;
    if (oldest !== undefined) relationCache.delete(oldest);
  }
  relationCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Hook to fetch dashboard-card relationships.
 *
 * @param entityId - The ID of the entity (dashboard or card)
 * @param entityType - Whether to fetch cards for a dashboard or dashboards for a card
 * @returns Loading state, error state, and relationship data
 */
export function useDashboardCardRelations(
  entityId: string | undefined | null,
  entityType: "dashboard" | "card",
): {
  relations: DashboardCardRelation[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [relations, setRelations] = useState<DashboardCardRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRelations = useCallback(async () => {
    if (!entityId) {
      setRelations([]);
      return;
    }

    const cacheKey = `${entityType}:${entityId}`;
    const cached = getCachedData(cacheKey);
    if (cached.hit) {
      setRelations(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data =
        entityType === "dashboard"
          ? await fetchDashboardCards(entityId)
          : await fetchCardDashboards(entityId);

      setCachedData(cacheKey, data);
      setRelations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setRelations([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  const refetch = useCallback(() => {
    if (entityId) {
      // Clear cache entry to force refetch
      const cacheKey = `${entityType}:${entityId}`;
      relationCache.delete(cacheKey);
      fetchRelations();
    }
  }, [entityId, entityType, fetchRelations]);

  return { relations, loading, error, refetch };
}

/**
 * Generate URL for navigating to a dashboard detail page.
 */
export function getDashboardUrl(dashboardId: string): string {
  return `/dashboard/${dashboardId}`;
}

/**
 * Generate URL for navigating to a card detail page.
 */
export function getCardUrl(cardId: string): string {
  return `/card/${cardId}`;
}

/**
 * Generate the appropriate URL for a relation based on its type.
 */
export function getRelationUrl(relation: DashboardCardRelation): string {
  return relation.type === "dashboard"
    ? getDashboardUrl(relation.id)
    : getCardUrl(relation.id);
}
