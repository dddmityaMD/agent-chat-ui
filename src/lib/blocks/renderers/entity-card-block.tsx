"use client";

import { useState } from "react";
import type { BlockRendererProps, EntityCardBlockData, EntityGroup } from "../types";
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
  GitBranch,
  Clock,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigateToLineage } from "@/components/lineage-link";

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

const PAGE_SIZE = 20;

interface EntityItemData {
  entity_type: string;
  uri: string;
  connector_type: string;
  display_name: string;
  description?: string;
  subtitle?: string;
  freshness?: string;
  properties: Record<string, unknown>;
  qualified_references: string[];
}

function LineageButton({ entity }: { entity: EntityItemData }) {
  if (!entity.uri) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigateToLineage([entity.uri], [entity.display_name]);
      }}
      className="ml-1 inline-flex shrink-0 items-center rounded p-0.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400"
      title="View in Lineage"
    >
      <GitBranch className="h-3 w-3" />
    </button>
  );
}

function EntityListItem({
  entity,
  defaultExpanded,
}: {
  entity: EntityItemData;
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
        {entity.freshness && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {entity.freshness}
          </span>
        )}
        <LineageButton entity={entity} />
        {hasDetails &&
          (expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ))}
      </button>

      {(entity.subtitle || entity.description) && (
        <div className="px-3 pb-2">
          {entity.subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {entity.subtitle}
            </p>
          )}
          {entity.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
              {entity.description}
            </p>
          )}
        </div>
      )}

      {expanded && hasDetails && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          {Object.keys(entity.properties).length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Properties ({Object.keys(entity.properties).length})
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
                References ({entity.qualified_references.length})
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
  entity: EntityItemData;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const hasDetails =
    Object.keys(entity.properties).length > 0 ||
    entity.qualified_references.length > 0 ||
    !!entity.description;

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
        {entity.subtitle && (
          <span className="w-full truncate text-[10px] text-gray-500 dark:text-gray-400">
            {entity.subtitle}
          </span>
        )}
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            {entity.connector_type}
          </span>
          <LineageButton entity={entity} />
        </div>
      </button>

      {isExpanded && hasDetails && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          {entity.description && (
            <p className="mb-2 line-clamp-3 text-xs text-gray-600 dark:text-gray-300">
              {entity.description}
            </p>
          )}
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

function GroupTab({
  group,
  isActive,
  onClick,
}: {
  group: EntityGroup;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {group.label} ({group.count})
    </button>
  );
}

function NextStepChips({ steps }: { steps: string[] }) {
  // TODO: wire chips to send message to agent
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <span
          key={step}
          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        >
          {step}
        </span>
      ))}
    </div>
  );
}

export function EntityCardBlock({ block }: BlockRendererProps) {
  const data = block as EntityCardBlockData;
  const [activeTab, setActiveTab] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);

  // Backward compat: wrap old flat entities in a single group
  const groups: EntityGroup[] =
    data.groups && data.groups.length > 0
      ? data.groups
      : data.entities && data.entities.length > 0
        ? [
            {
              label: data.title || "Results",
              entity_type: "entity",
              count: data.entities.length,
              entities: data.entities,
            },
          ]
        : [];

  if (groups.length === 0) return null;

  const activeGroup = groups[activeTab] ?? groups[0];
  const entities = (activeGroup.entities ?? []) as EntityItemData[];
  const totalCount = activeGroup.count ?? entities.length;
  const visibleEntities = entities.slice(0, visibleCount);
  const hasMore = visibleCount < entities.length;

  // Reset visible count when switching tabs
  const handleTabChange = (idx: number) => {
    setActiveTab(idx);
    setVisibleCount(PAGE_SIZE);
    setExpandedGrid(null);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
      {/* Header */}
      {(data.header || data.title) && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {data.header || data.title}
          </h3>
        </div>
      )}

      {/* Next steps chips */}
      {data.next_steps && data.next_steps.length > 0 && (
        <div className="mb-3">
          <NextStepChips steps={data.next_steps} />
        </div>
      )}

      {/* Tabs (only when multiple groups) */}
      {groups.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {groups.map((group, idx) => (
            <GroupTab
              key={group.entity_type}
              group={group}
              isActive={idx === activeTab}
              onClick={() => handleTabChange(idx)}
            />
          ))}
        </div>
      )}

      {/* List layout */}
      {data.layout === "list" && (
        <div className="space-y-1.5">
          {visibleEntities.map((entity) => (
            <EntityListItem key={entity.uri || entity.display_name} entity={entity} />
          ))}
        </div>
      )}

      {/* Grid layout */}
      {data.layout === "grid" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleEntities.map((entity) => (
            <EntityGridItem
              key={entity.uri || entity.display_name}
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

      {/* Progressive loading / show more */}
      {hasMore && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            Show more
          </Button>
          <span className="text-xs text-gray-500">
            Showing {visibleEntities.length} of {totalCount}{" "}
            {activeGroup.label?.toLowerCase() ?? "items"}
          </span>
        </div>
      )}

      {/* Count info when not paginating but DB has more than shown */}
      {!hasMore && totalCount > entities.length && (
        <div className="mt-2">
          <span className="text-xs text-gray-500">
            Showing {entities.length} of {totalCount}{" "}
            {activeGroup.label?.toLowerCase() ?? "items"}
          </span>
        </div>
      )}
    </div>
  );
}
