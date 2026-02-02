"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ConnectorStatus,
  getStatusColorClass,
  formatLastFetch,
} from "@/hooks/useConnectorStatus";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/**
 * Icon components for connector types
 */
const DatabaseIcon = () => (
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
    <ellipse
      cx="12"
      cy="5"
      rx="9"
      ry="3"
    />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const LayoutDashboardIcon = () => (
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
    <rect
      width="7"
      height="9"
      x="3"
      y="3"
      rx="1"
    />
    <rect
      width="7"
      height="5"
      x="14"
      y="3"
      rx="1"
    />
    <rect
      width="7"
      height="9"
      x="14"
      y="12"
      rx="1"
    />
    <rect
      width="7"
      height="5"
      x="3"
      y="16"
      rx="1"
    />
  </svg>
);

const FileCodeIcon = () => (
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
    <path d="M10 12.5 8 15l2 2.5" />
    <path d="m14 12.5 2 2.5-2 2.5" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5" />
  </svg>
);

const GitBranchIcon = () => (
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
    <line
      x1="6"
      x2="6"
      y1="3"
      y2="15"
    />
    <circle
      cx="18"
      cy="6"
      r="3"
    />
    <circle
      cx="6"
      cy="18"
      r="3"
    />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const GlobeIcon = () => (
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
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <line
      x1="2"
      x2="22"
      y1="12"
      y2="12"
    />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

const CopyIcon = () => (
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
    <rect
      width="14"
      height="14"
      x="8"
      y="8"
      rx="2"
      ry="2"
    />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
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
    className="transition-transform duration-200"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Get icon component for connector type
 */
function getConnectorIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    metabase: <LayoutDashboardIcon />,
    postgres: <DatabaseIcon />,
    database: <DatabaseIcon />,
    dbt: <FileCodeIcon />,
    git: <GitBranchIcon />,
    api: <GlobeIcon />,
  };
  return icons[type.toLowerCase()] || <GlobeIcon />;
}

/**
 * Props for ConnectorStatusCard
 */
export interface ConnectorStatusCardProps {
  /** Connector status data */
  connector: ConnectorStatus;
  /** Whether the card is expanded */
  expanded?: boolean;
  /** Callback when expand/collapse is toggled */
  onToggle?: () => void;
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Callback for refresh action */
  onRefresh?: (name: string) => Promise<void>;
  /** Whether a refresh is in progress */
  isRefreshing?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ConnectorStatusCard displays health status for a single connector
 *
 * Features:
 * - Traffic light status indicator (green/yellow/red circle)
 * - Expandable details section
 * - Server URL with hostname display (click to show full URL)
 * - Last fetch timestamp with relative time and ISO hover
 * - Response time display
 * - Capabilities list
 * - Error message display for unhealthy/degraded status
 * - Refresh action button
 */
export function ConnectorStatusCard({
  connector,
  expanded: controlledExpanded,
  onToggle,
  showDetails = true,
  onRefresh,
  isRefreshing = false,
  className,
}: ConnectorStatusCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use controlled or uncontrolled expanded state
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [onToggle]);

  const handleCopyUrl = useCallback(async () => {
    if (!connector.server_url) return;

    try {
      await navigator.clipboard.writeText(connector.server_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  }, [connector.server_url]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh(connector.name);
    }
  }, [onRefresh, connector.name]);

  const statusColor = getStatusColorClass(connector.status);
  const hasError =
    connector.status === "unhealthy" || connector.status === "degraded";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-all duration-200",
        hasError && "border-red-200 bg-red-50/30",
        className,
      )}
      data-testid={`connector-card-${connector.name}`}
    >
      {/* Header - Always visible */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50/50"
        aria-expanded={isExpanded}
      >
        {/* Traffic light status circle */}
        <div
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusColor)}
          title={`Status: ${connector.status}`}
        />

        {/* Connector type icon */}
        <div className="text-gray-500">{getConnectorIcon(connector.type)}</div>

        {/* Connector name and hostname */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{connector.name}</div>
          {connector.hostname && (
            <div className="truncate text-xs text-gray-500">
              {connector.hostname}
            </div>
          )}
        </div>

        {/* Expand/collapse indicator */}
        <div
          className={cn(
            "text-gray-400 transition-transform duration-200",
            isExpanded && "rotate-180",
          )}
        >
          <ChevronDownIcon />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && showDetails && (
        <div className="border-t px-3 pb-3 pt-2">
          {/* Server URL */}
          {connector.server_url && (
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-500">Server</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowFullUrl((prev) => !prev)}
                  className="truncate text-sm text-blue-600 hover:underline"
                >
                  {showFullUrl ? connector.server_url : connector.hostname}
                </button>
                {showFullUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCopyUrl}
                        className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Copy URL"
                      >
                        <CopyIcon />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copied ? "Copied!" : "Copy URL"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Last check / Last successful fetch */}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-500">
                Last checked
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm">
                    {formatLastFetch(connector.last_check_at)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {connector.last_check_at || "Never checked"}
                </TooltipContent>
              </Tooltip>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">
                Response time
              </div>
              <div className="text-sm">
                {connector.response_time_ms != null
                  ? `${connector.response_time_ms}ms`
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Capabilities */}
          {connector.capabilities.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-500">
                Capabilities
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {connector.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {hasError && connector.error_message && (
            <div className="mb-2 rounded bg-red-50 p-2">
              <div className="text-xs font-medium text-red-700">Error</div>
              <div className="text-xs text-red-600">
                {connector.error_message}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCwIcon />
              {isRefreshing ? "Checking..." : "Refresh"}
            </Button>
            {hasError && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-7 text-xs"
              >
                Test Connection
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectorStatusCard;
