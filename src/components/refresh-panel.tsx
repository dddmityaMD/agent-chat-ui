"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useRefreshStream, type RefreshJob, type ConnectionState } from "@/hooks/use-refresh-stream";
import { JobStatusBadge, JobStatusDot } from "@/components/ui/job-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Icons (using simple SVGs to avoid dependency issues)
const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const RefreshCwIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);

const WifiIcon = ({ connected }: { connected: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={connected ? "text-green-500" : "text-red-500"}>
    <path d="M12 20h.01"/>
    <path d="M2 12.83a23 23 0 0 1 20 0"/>
    <path d="M5 16.22a17 17 0 0 1 14 0"/>
    <path d="M8.5 19.14a11 11 0 0 1 7 0"/>
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
  </svg>
);

interface ConnectorSectionProps {
  title: string;
  type: string;
  jobs: RefreshJob[];
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: (jobId: string) => void;
}

function ConnectorSection({
  title,
  type,
  jobs,
  isExpanded,
  onToggle,
  onRetry,
}: ConnectorSectionProps) {
  const runningJobs = jobs.filter((j) => j.status === "running");
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const hasIssues = failedJobs.length > 0;

  if (jobs.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors",
          hasIssues && "bg-red-50/50 hover:bg-red-50"
        )}
        data-testid={`connector-section-${type}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-500">
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </div>
          <span className="font-medium text-sm">{title}</span>
          {runningJobs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <ActivityIcon />
              {runningJobs.length} running
            </span>
          )}
          {failedJobs.length > 0 && (
            <span className="text-xs text-red-600 font-medium">
              {failedJobs.length} failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{jobs.length} jobs</span>
          {runningJobs.length > 0 && (
            <JobStatusDot status="running" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {jobs.length === 0 ? (
            <div className="text-sm text-gray-500 py-2 text-center">
              No jobs for this connector
            </div>
          ) : (
            <>
              {/* Running jobs first */}
              {runningJobs.map((job) => (
                <div
                  key={job.job_id}
                  className="flex items-center justify-between p-2 bg-blue-50/50 rounded-lg border border-blue-100"
                  data-testid={`job-${job.job_id}`}
                >
                  <div className="flex items-center gap-3">
                    <JobStatusDot status="running" />
                    <div>
                      <div className="text-sm font-medium">{job.scope}</div>
                      <div className="text-xs text-gray-500">
                        Started {new Date(job.started_at || Date.now()).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  {job.entities_updated > 0 && (
                    <div className="text-xs text-gray-500">
                      {job.entities_updated} entities
                    </div>
                  )}
                </div>
              ))}

              {/* Other jobs */}
              {jobs
                .filter((j) => j.status !== "running")
                .slice(0, 10)
                .map((job) => (
                  <div
                    key={job.job_id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    data-testid={`job-${job.job_id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <JobStatusBadge
                        job={job}
                        onRetry={onRetry}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{job.scope}</div>
                        {job.last_error && (
                          <div className="text-xs text-red-500 truncate" title={job.last_error}>
                            {job.last_error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface RefreshPanelProps {
  className?: string;
}

export function RefreshPanel({ className }: RefreshPanelProps) {
  const {
    jobs,
    summary,
    connectionState,
    error,
    reconnectAttempts,
    reconnect,
    disconnect,
  } = useRefreshStream();

  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["metabase", "dbt", "warehouse"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleRetry = (jobId: string) => {
    // TODO: Implement retry logic - would call API to retry job
    console.log("Retry job:", jobId);
  };

  // Group jobs by connector from summary or compute from jobs
  const grouped = summary?.grouped || {
    metabase: jobs.filter((j) => j.connector_type?.toLowerCase().includes("metabase")),
    dbt: jobs.filter((j) => j.connector_type?.toLowerCase().includes("dbt")),
    warehouse: jobs.filter((j) =>
      j.connector_type?.toLowerCase().includes("warehouse") ||
      j.connector_type?.toLowerCase().includes("postgres")
    ),
    other: jobs.filter((j) =>
      !j.connector_type ||
      (!j.connector_type.toLowerCase().includes("metabase") &&
       !j.connector_type.toLowerCase().includes("dbt") &&
       !j.connector_type.toLowerCase().includes("warehouse") &&
       !j.connector_type.toLowerCase().includes("postgres"))
    ),
  };

  const connectionIndicator = {
    connecting: { color: "text-amber-500", label: "Connecting..." },
    connected: { color: "text-green-500", label: "Live" },
    disconnected: { color: "text-gray-400", label: "Disconnected" },
    error: { color: "text-red-500", label: "Error" },
  }[connectionState];

  return (
    <Card className={cn("w-full", className)} data-testid="refresh-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ActivityIcon />
            Refresh Jobs
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className={cn("flex items-center gap-1.5 text-xs", connectionIndicator.color)}
              title={error ? error.message : undefined}
              data-testid="connection-status"
            >
              <WifiIcon connected={connectionState === "connected"} />
              <span>{connectionIndicator.label}</span>
              {reconnectAttempts > 0 && connectionState !== "connected" && (
                <span className="text-gray-400">(retry {reconnectAttempts})</span>
              )}
            </div>

            {/* Reconnect button when disconnected/error */}
            {connectionState !== "connected" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reconnect}
                className="h-7 px-2"
                data-testid="reconnect-button"
              >
                <RefreshCwIcon />
              </Button>
            )}
          </div>
        </div>

        {/* Running jobs summary */}
        {summary?.has_running && (
          <div className="mt-2 p-2 bg-blue-50 rounded-md flex items-center gap-2">
            <JobStatusDot status="running" />
            <span className="text-sm text-blue-700">
              {summary.running_count} job{summary.running_count !== 1 ? "s" : ""} running
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Connector sections */}
        <ConnectorSection
          title="Metabase"
          type="metabase"
          jobs={grouped.metabase}
          isExpanded={expandedSections.has("metabase")}
          onToggle={() => toggleSection("metabase")}
          onRetry={handleRetry}
        />
        <ConnectorSection
          title="dbt"
          type="dbt"
          jobs={grouped.dbt}
          isExpanded={expandedSections.has("dbt")}
          onToggle={() => toggleSection("dbt")}
          onRetry={handleRetry}
        />
        <ConnectorSection
          title="Warehouse"
          type="warehouse"
          jobs={grouped.warehouse}
          isExpanded={expandedSections.has("warehouse")}
          onToggle={() => toggleSection("warehouse")}
          onRetry={handleRetry}
        />
        {grouped.other.length > 0 && (
          <ConnectorSection
            title="Other"
            type="other"
            jobs={grouped.other}
            isExpanded={expandedSections.has("other")}
            onToggle={() => toggleSection("other")}
            onRetry={handleRetry}
          />
        )}

        {/* Empty state */}
        {jobs.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <ActivityIcon />
            </div>
            <p className="text-sm text-gray-500">No refresh jobs yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Jobs will appear here when refresh operations run
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RefreshPanel;
