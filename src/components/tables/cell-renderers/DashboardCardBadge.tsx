"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ICellRendererParams } from "ag-grid-community";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardCardRelation,
  getRelationUrl,
  useDashboardCardRelations,
} from "@/lib/dashboard-card-links";

/**
 * Maximum number of badges to display before showing "+N more" overflow badge.
 */
const MAX_VISIBLE_BADGES = 3;

/**
 * Maximum characters for badge text before truncation.
 */
const MAX_NAME_LENGTH = 20;

/**
 * Truncate text with ellipsis if too long.
 */
function truncateName(name: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength - 1) + "\u2026"; // Use ellipsis character
}

/**
 * Props for DashboardCardBadge component.
 */
export interface DashboardCardBadgeProps {
  relations: DashboardCardRelation[];
  entityType: "dashboard" | "card";
  className?: string;
}

/**
 * DashboardCardBadge - Renders clickable badges for dashboard-card relationships.
 *
 * - Dashboard rows show blue card badges
 * - Card/report rows show orange dashboard badges
 * - Clicking navigates to the related entity
 * - Truncates long names with full name in tooltip
 * - Shows "+N more" badge when more than 3 relationships
 */
export function DashboardCardBadge({
  relations,
  entityType,
  className,
}: DashboardCardBadgeProps): React.ReactElement | null {
  const router = useRouter();

  const visibleBadges = useMemo(
    () => relations.slice(0, MAX_VISIBLE_BADGES),
    [relations],
  );

  const overflowCount = Math.max(0, relations.length - MAX_VISIBLE_BADGES);

  const handleBadgeClick = (
    e: React.MouseEvent,
    relation: DashboardCardRelation,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const url = getRelationUrl(relation);
    router.push(url);
  };

  if (relations.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">None</span>
    );
  }

  // Determine badge styling based on what we're showing
  // Dashboard rows show cards (blue), Card rows show dashboards (orange)
  const badgeClasses =
    entityType === "dashboard"
      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";

  const IconComponent = entityType === "dashboard" ? BarChart3 : LayoutDashboard;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} data-testid="relationship-badges">
      {visibleBadges.map((relation) => {
        const truncatedName = truncateName(relation.name);
        const showTooltip = relation.name.length > MAX_NAME_LENGTH;

        return (
          <button
            key={`${relation.type}-${relation.id}`}
            onClick={(e) => handleBadgeClick(e, relation)}
            title={showTooltip ? relation.name : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              "text-xs font-medium cursor-pointer transition-colors",
              badgeClasses,
            )}
            data-testid={`relationship-badge-${relation.type}`}
          >
            <IconComponent className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{truncatedName}</span>
          </button>
        );
      })}

      {overflowCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5",
            "text-xs font-medium",
            "bg-gray-100 text-gray-600 border-gray-200",
          )}
          title={`${overflowCount} more ${entityType === "dashboard" ? "cards" : "dashboards"}`}
          data-testid="overflow-badge"
        >
          +{overflowCount} more
        </span>
      )}
    </div>
  );
}

/**
 * AG Grid cell renderer for dashboard-card badges.
 *
 * Extracts relations from row data or fetches via hook if not available.
 * Row data should have:
 * - dashboard_cards: for dashboard rows (array of relations)
 * - parent_dashboards: for card/report rows (array of relations)
 * - card_id/dashboard_id: for fetching if relations not in row data
 */
export function DashboardCardBadgeCell(
  params: ICellRendererParams,
): React.ReactElement | null {
  const { data, colDef } = params;

  // Determine entity type from column field or data
  const field = colDef?.field;
  const isForDashboard = field === "dashboard_cards" || data?.entity_type === "dashboard";
  // isForCard is used implicitly: if not isForDashboard, treat as card row
  const _isForCard = field === "parent_dashboards" || data?.entity_type === "report" || data?.entity_type === "card";
  void _isForCard; // Suppress unused variable warning - kept for documentation

  // Get relations from row data if available
  const rowRelations: DashboardCardRelation[] | undefined = isForDashboard
    ? data?.dashboard_cards
    : data?.parent_dashboards;

  // Get entity ID for fetching if relations not in row data
  const entityId = isForDashboard
    ? data?.dashboard_id?.toString()
    : data?.card_id?.toString();

  const entityType = isForDashboard ? "dashboard" : "card";

  // Use hook to fetch relations if not in row data
  const { relations: fetchedRelations, loading } = useDashboardCardRelations(
    rowRelations === undefined ? entityId : undefined,
    entityType,
  );

  // Prefer row data relations, fall back to fetched
  const relations = rowRelations ?? fetchedRelations;

  if (loading) {
    return (
      <span className="text-xs text-muted-foreground">Loading...</span>
    );
  }

  return (
    <DashboardCardBadge relations={relations} entityType={entityType} />
  );
}

export default DashboardCardBadge;
