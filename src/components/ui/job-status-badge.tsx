"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { RefreshJob, RefreshJobStatus } from "@/hooks/use-refresh-stream";

// Format relative time (e.g., "2m ago", "3h ago", "1d ago")
function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return "never";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Get status color classes
function getStatusColor(status: RefreshJobStatus): string {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "running":
      return "bg-blue-50 text-blue-600 border-blue-200";
    case "done":
      return "bg-green-50 text-green-600 border-green-200";
    case "failed":
      return "bg-red-50 text-red-600 border-red-200";
    case "cancelled":
      return "bg-amber-50 text-amber-600 border-amber-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// Get status indicator dot color
function getStatusDotColor(status: RefreshJobStatus): string {
  switch (status) {
    case "pending":
      return "bg-gray-400";
    case "running":
      return "bg-blue-500 animate-pulse";
    case "done":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

// Get status label
function getStatusLabel(status: RefreshJobStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

interface JobStatusBadgeProps {
  job: RefreshJob;
  showRetryCount?: boolean;
  className?: string;
  onRetry?: (jobId: string) => void;
}

export function JobStatusBadge({
  job,
  showRetryCount = true,
  className,
  onRetry,
}: JobStatusBadgeProps) {
  const timeString = formatRelativeTime(
    job.completed_at || job.started_at || job.created_at
  );
  const fullTime = new Date(
    job.completed_at || job.started_at || job.created_at || Date.now()
  ).toLocaleString();
  
  const canRetry = job.status === "failed" && onRetry;
  const showAttempts = showRetryCount && (job.attempts > 1 || job.status === "failed");
  
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm",
        getStatusColor(job.status),
        className
      )}
      title={`${getStatusLabel(job.status)} at ${fullTime}`}
      data-testid={`job-status-badge-${job.job_id}`}
    >
      {/* Status dot */}
      <span
        className={cn("w-2 h-2 rounded-full", getStatusDotColor(job.status))}
        data-testid="status-dot"
      />
      
      {/* Status label */}
      <span className="font-medium">{getStatusLabel(job.status)}</span>
      
      {/* Relative time */}
      <span className="text-xs opacity-70">{timeString}</span>
      
      {/* Retry count for failed jobs */}
      {showAttempts && (
        <span className="text-xs opacity-70">
          ({job.attempts}/{job.max_attempts})
        </span>
      )}
      
      {/* Retry button for failed jobs */}
      {canRetry && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry(job.job_id);
          }}
          className="ml-1 px-2 py-0.5 text-xs bg-white/50 hover:bg-white/80 rounded transition-colors"
          data-testid="retry-button"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Simple variant for compact display
interface JobStatusDotProps {
  status: RefreshJobStatus;
  className?: string;
}

export function JobStatusDot({ status, className }: JobStatusDotProps) {
  return (
    <span
      className={cn(
        "w-2.5 h-2.5 rounded-full",
        getStatusDotColor(status),
        className
      )}
      title={getStatusLabel(status)}
      data-testid="job-status-dot"
    />
  );
}

export default JobStatusBadge;
