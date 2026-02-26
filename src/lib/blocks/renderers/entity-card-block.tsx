"use client";

import { useState } from "react";
import type { BlockRendererProps } from "../types";
import type { EntityCardBlockData } from "../types";
import {
  LayoutDashboard,
  BarChart3,
  FileCode,
  Database,
  Table2,
  TrendingUp,
  CheckCircle,
  Box,
  ChevronDown,
  ChevronRight,
  Grid3x3,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ENTITY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  card: BarChart3,
  model: FileCode,
  source: Database,
  table: Table2,
  metric: TrendingUp,
  test: CheckCircle,
  column: List,
};

function EntityIcon({
  entityType,
  className,
}: {
  entityType: string;
  className?: string;
}) {
  const Icon = ENTITY_ICON_MAP[entityType] ?? Box;
  return <Icon className={className} />;
}

const DISPLAY_LIMIT = 10;

interface EntityItem {
  entity_type: string;
  uri: string;
  connector_type: string;
  display_name: string;
  properties: Record<string, unknown>;
  qualified_references: string[];
}

function EntityListItem({
  entity,
  defaultExpanded,
}: {
  entity: EntityItem;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const hasDetails =
    Object.keys(entity.properties).length > 0 ||
    entity.qualified_references.length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white/80 dark:border-gray-700 dark:bg-gray-900/50">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((prev) => !prev)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
          hasDetails ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "cursor-default"
        }`}
      >
        <EntityIcon
          entityType={entity.entity_type}
          className="h-4 w-4 shrink-0 text-gray-500"
        />
        <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">
          {entity.display_name}
        </span>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {entity.entity_type}
        </span>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          {entity.connector_type}
        </span>
        {hasDetails &&
          (expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ))}
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          {/* Properties */}
          {Object.keys(entity.properties).length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Properties
              </p>
              <div className="space-y-0.5">
                {Object.entries(entity.properties).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-medium text-gray-600 dark:text-gray-400">
                      {key}:
                    </span>
                    <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Qualified references */}
          {entity.qualified_references.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                References
              </p>
              <div className="flex flex-wrap gap-1">
                {entity.qualified_references.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntityGridItem({
  entity,
  onExpand,
  isExpanded,
}: {
  entity: EntityItem;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const hasDetails =
    Object.keys(entity.properties).length > 0 ||
    entity.qualified_references.length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white/80 dark:border-gray-700 dark:bg-gray-900/50">
      <button
        type="button"
        onClick={hasDetails ? onExpand : undefined}
        className={`flex w-full flex-col items-center gap-1.5 p-3 text-center ${
          hasDetails ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "cursor-default"
        }`}
      >
        <EntityIcon
          entityType={entity.entity_type}
          className="h-5 w-5 text-gray-500"
        />
        <span className="w-full truncate text-xs font-medium text-gray-800 dark:text-gray-200">
          {entity.display_name}
        </span>
        <div className="flex gap-1">
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {entity.entity_type}
          </span>
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            {entity.connector_type}
          </span>
        </div>
      </button>

      {/* Inline expansion for grid items */}
      {isExpanded && hasDetails && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          {Object.keys(entity.properties).length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Properties
              </p>
              <div className="space-y-0.5">
                {Object.entries(entity.properties).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-medium text-gray-600 dark:text-gray-400">
                      {key}:
                    </span>
                    <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {entity.qualified_references.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                References
              </p>
              <div className="flex flex-wrap gap-1">
                {entity.qualified_references.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EntityCardBlock({ block }: BlockRendererProps) {
  const data = block as EntityCardBlockData;
  const [showAll, setShowAll] = useState(false);
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);

  // Null guard: prevent crash when entities is undefined/null (UAT gap 3)
  if (!data?.entities || !Array.isArray(data.entities)) {
    return null;
  }

  const entities = data.entities as EntityItem[];
  const needsTruncation = entities.length > DISPLAY_LIMIT;
  const visibleEntities =
    showAll || !needsTruncation
      ? entities
      : entities.slice(0, DISPLAY_LIMIT);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
      {/* Header */}
      {data.title && (
        <div className="mb-3 flex items-center gap-2">
          {data.layout === "grid" ? (
            <Grid3x3 className="h-4 w-4 text-gray-500" />
          ) : (
            <List className="h-4 w-4 text-gray-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {data.title}
          </h3>
          <span className="text-xs text-gray-500">
            {entities.length} entit{entities.length !== 1 ? "ies" : "y"}
          </span>
        </div>
      )}

      {/* List layout */}
      {data.layout === "list" && (
        <div className="space-y-1.5">
          {visibleEntities.map((entity) => (
            <EntityListItem key={entity.uri} entity={entity} />
          ))}
        </div>
      )}

      {/* Grid layout */}
      {data.layout === "grid" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleEntities.map((entity) => (
            <EntityGridItem
              key={entity.uri}
              entity={entity}
              isExpanded={expandedGrid === entity.uri}
              onExpand={() =>
                setExpandedGrid((prev) =>
                  prev === entity.uri ? null : entity.uri,
                )
              }
            />
          ))}
        </div>
      )}

      {/* Show all button */}
      {needsTruncation && !showAll && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setShowAll(true)}
          >
            Show all {entities.length} items
          </Button>
        </div>
      )}
    </div>
  );
}
