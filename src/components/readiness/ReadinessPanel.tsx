"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  useReadinessPolling,
  useParallelExecution,
  getStatusColorClass,
  formatLastFetch,
  type ConnectorStatus,
  type ParallelExecutionJob,
} from "@/hooks/useConnectorStatus";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { ConnectorStatusCard } from "./ConnectorStatusCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Icon components
 */
const ActivityIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const LoaderIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <line
      x1="12"
      x2="12"
      y1="8"
      y2="12"
    />
    <line
      x1="12"
      x2="12.01"
      y1="16"
      y2="16"
    />
  </svg>
);

/** Connector type icons for the empty state */
const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const CodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <path d="M10 12.5 8 15l2 2.5" />
    <path d="m14 12.5 2 2.5-2 2.5" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5" />
  </svg>
);

const GitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

/**
 * Get status icon based on job status
 */
function getJobStatusIcon(
  status: ParallelExecutionJob["status"],
): React.ReactNode {
  switch (status) {
    case "pending":
      return <span className="h-2 w-2 rounded-full bg-gray-400" />;
    case "in_progress":
      return <LoaderIcon />;
    case "done":
      return (
        <span className="text-green-600">
          <CheckIcon />
        </span>
      );
    case "error":
      return (
        <span className="text-red-600">
          <AlertCircleIcon />
        </span>
      );
  }
}

/**
 * Props for ReadinessPanel
 */
export interface ReadinessPanelProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show parallel execution section */
  showParallelExecution?: boolean;
  /** Active parallel execution jobs (from external source) */
  parallelJobs?: ParallelExecutionJob[];
  /** Polling interval in ms (default: 30000) */
  pollingInterval?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
}

/**
 * ReadinessPanel displays overall system readiness with connector health
 *
 * Features:
 * - Full-width layout (parent controls width)
 * - No-connector state: "No data sources connected" with link to settings
 * - Connector cards with status, timestamps, entity counts
 * - Summary line: "N connectors - M healthy - X total entities"
 * - Parallel execution progress visualization
 * - Auto-refresh with configurable interval
 * - Manual refresh button
 * - Collapsible for minimal footprint
 * - Last checked timestamp
 */
export function ReadinessPanel({
  className,
  showParallelExecution = false,
  parallelJobs: externalJobs,
  pollingInterval = 30000,
  enabled = true,
}: ReadinessPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(
    null,
  );
  const [refreshingConnector, setRefreshingConnector] = useState<string | null>(
    null,
  );

  // Use readiness polling hook
  const {
    connectors,
    overallStatus,
    statusSummary,
    checkedAt,
    isLoading,
    error,
    refresh,
  } = useReadinessPolling({
    interval: pollingInterval,
    enabled,
  });

  // Use setup status for first-run detection
  const { data: setupStatus } = useSetupStatus(pollingInterval);

  // Use parallel execution tracking (internal state)
  const { jobs: internalJobs, isExecuting } = useParallelExecution();

  // Use external jobs if provided, otherwise internal
  const parallelJobs = externalJobs || internalJobs;
  const hasActiveExecution = isExecuting || (parallelJobs?.length ?? 0) > 0;

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleConnectorRefresh = useCallback(
    async (name: string) => {
      setRefreshingConnector(name);
      try {
        // Trigger manual check via API
        const baseUrl =
          typeof window !== "undefined"
            ? window.location.origin.replace(/:\d+$/, ":8000")
            : "http://localhost:8000";

        const response = await fetch(
          `${baseUrl}/api/readiness/check/${encodeURIComponent(name)}`,
          { method: "POST" },
        );

        if (!response.ok && response.status !== 429) {
          console.error("Failed to refresh connector:", name);
        }

        // Refresh all data to get updated status
        await refresh();
      } finally {
        setRefreshingConnector(null);
      }
    },
    [refresh],
  );

  const handleConnectorToggle = useCallback((name: string) => {
    setExpandedConnector((prev) => (prev === name ? null : name));
  }, []);

  const overallStatusColor = getStatusColorClass(overallStatus);

  // Count issues for summary
  const unhealthyCount = connectors.filter(
    (c) => c.status === "unhealthy",
  ).length;
  const degradedCount = connectors.filter(
    (c) => c.status === "degraded",
  ).length;
  const healthyCount = connectors.filter(
    (c) => c.status === "healthy",
  ).length;
  const totalEntities = connectors.reduce(
    (sum, c) => sum + (c.entity_count ?? 0),
    0,
  );

  // Determine if we're in no-connector state
  const hasNoConnectors = setupStatus?.has_connectors === false;
  const isReady = setupStatus?.is_ready === true;

  return (
    <Card
      className={cn("w-full", className)}
      data-testid="readiness-panel"
    >
      <CardHeader className="pb-3">
        {/* Header row with title and controls */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon />
            System Readiness
          </CardTitle>
          <div className="flex items-center gap-1">
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-7 w-7 p-0"
              title="Refresh status"
              data-testid="refresh-readiness"
            >
              <RefreshCwIcon />
            </Button>
            {/* Collapse button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((prev) => !prev)}
              className="h-7 w-7 p-0"
              title={collapsed ? "Expand" : "Collapse"}
            >
              <div
                className={cn(
                  "transition-transform duration-200",
                  collapsed && "rotate-180",
                )}
              >
                <ChevronDownIcon />
              </div>
            </Button>
          </div>
        </div>

        {/* Overall status indicator */}
        {!hasNoConnectors && (
          <div className="mt-2 flex items-center gap-3" data-testid="overall-status">
            <div
              className={cn("h-4 w-4 shrink-0 rounded-full", overallStatusColor)}
              title={`Overall: ${overallStatus}`}
              data-status={overallStatus}
            />
            <div>
              <div className="text-sm font-medium">{statusSummary}</div>
              {(unhealthyCount > 0 || degradedCount > 0) && (
                <div className="text-xs text-gray-500">
                  {unhealthyCount > 0 && (
                    <span className="text-red-600">
                      {unhealthyCount} down
                      {degradedCount > 0 ? ", " : ""}
                    </span>
                  )}
                  {degradedCount > 0 && (
                    <span className="text-yellow-600">{degradedCount} degraded</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* System ready / needs attention banners */}
        {!hasNoConnectors && connectors.length > 0 && (
          <>
            {isReady ? (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                System ready
              </div>
            ) : (
              <div className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Some connectors need attention{" "}
                <Link href="/settings/connectors" className="font-medium underline hover:text-yellow-900">
                  View in settings
                </Link>
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">
            {error.message}
          </div>
        )}
      </CardHeader>

      {/* Content - collapsible */}
      {!collapsed && (
        <CardContent className="pt-0">
          {/* No-connector state (ONBOARD-02) */}
          {hasNoConnectors && (
            <div className="flex flex-col items-center py-8 text-center" data-testid="no-connectors-state">
              <div className="mb-4 text-lg font-semibold text-gray-700">
                No data sources connected
              </div>
              <p className="mb-6 max-w-md text-sm text-gray-500">
                Connect your databases, BI tools, and dbt projects to get started
              </p>
              {/* Supported connector type icons */}
              <div className="mb-6 flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <DatabaseIcon />
                  <span className="text-xs text-gray-400">PostgreSQL</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <DashboardIcon />
                  <span className="text-xs text-gray-400">Metabase</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <CodeIcon />
                  <span className="text-xs text-gray-400">dbt</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <GitIcon />
                  <span className="text-xs text-gray-400">Git</span>
                </div>
              </div>
              <Link href="/settings/connectors">
                <Button size="lg" data-testid="connect-data-sources-btn">
                  Connect Data Sources
                </Button>
              </Link>
            </div>
          )}

          {/* Parallel execution section */}
          {showParallelExecution && hasActiveExecution && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3">
              <div className="mb-2 text-xs font-medium text-blue-800">
                Collecting evidence...
              </div>
              <div className="space-y-1">
                {parallelJobs?.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    {getJobStatusIcon(job.status)}
                    <span
                      className={cn(
                        job.status === "done" && "text-green-700",
                        job.status === "error" && "text-red-700",
                        job.status === "in_progress" && "text-blue-700",
                        job.status === "pending" && "text-gray-500",
                      )}
                    >
                      {job.source}
                    </span>
                    {job.status === "in_progress" &&
                      job.progress !== undefined && (
                        <span className="text-xs text-gray-500">
                          ({job.progress}%)
                        </span>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connector list (when connectors exist) */}
          {!hasNoConnectors && (
            <>
              {/* Summary line */}
              {connectors.length > 0 && (
                <div className="mb-3 text-sm text-gray-600" data-testid="connector-summary">
                  {connectors.length} connector{connectors.length !== 1 ? "s" : ""}{" "}
                  &middot; {healthyCount} healthy{" "}
                  &middot; {totalEntities} total entities
                </div>
              )}

              {/* Connector cards grid */}
              <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {connectors.length === 0 && isLoading && (
                  <div className="col-span-full flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                    <LoaderIcon />
                    Loading connectors...
                  </div>
                )}
                {connectors.map((connector) => (
                  <ConnectorStatusCard
                    key={connector.name}
                    connector={connector}
                    expanded={expandedConnector === connector.name}
                    onToggle={() => handleConnectorToggle(connector.name)}
                    onRefresh={handleConnectorRefresh}
                    isRefreshing={refreshingConnector === connector.name}
                  />
                ))}
              </div>
            </>
          )}

          {/* Footer with last checked timestamp */}
          {checkedAt && !hasNoConnectors && (
            <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-gray-400">
              <span>Last checked: {formatLastFetch(checkedAt)}</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Auto-refresh on
              </span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default ReadinessPanel;
