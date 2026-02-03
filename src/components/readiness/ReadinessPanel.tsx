"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  useReadinessPolling,
  useParallelExecution,
  getStatusColorClass,
  formatLastFetch,
  type ConnectorStatus,
  type ParallelExecutionJob,
} from "@/hooks/useConnectorStatus";
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
 * - Overall status indicator with summary text
 * - List of connectors sorted by status (issues first)
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

  return (
    <Card
      className={cn("w-full max-w-sm", className)}
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

          {/* Connector list */}
          <div className="space-y-2">
            {connectors.length === 0 && !isLoading && (
              <div className="py-4 text-center text-sm text-gray-500">
                No connectors configured
              </div>
            )}
            {connectors.length === 0 && isLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
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

          {/* Footer with last checked timestamp */}
          {checkedAt && (
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
