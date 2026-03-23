"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { VerificationResult, VerificationStatus } from "@/lib/types";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface VerificationBadgeProps {
  result: VerificationResult;
  className?: string;
}

// Status configuration
const statusConfig: Record<
  VerificationStatus,
  {
    Icon: typeof CheckCircle2;
    label: string;
    className: string;
  }
> = {
  VERIFIED_FIXED: {
    Icon: CheckCircle2,
    label: "Verified Fixed",
    className:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  PARTIALLY_FIXED: {
    Icon: AlertTriangle,
    label: "Partially Fixed",
    className:
      "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  },
  NOT_FIXED: {
    Icon: XCircle,
    label: "Not Fixed",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  REGRESSION_DETECTED: {
    Icon: AlertOctagon,
    label: "Regression Detected",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

export function VerificationBadge({
  result,
  className,
}: VerificationBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = statusConfig[result.status];
  const Icon = config.Icon;

  const hasSnapshots = result.before_snapshot || result.after_snapshot;

  return (
    <div
      className={cn("rounded-lg border p-3", className)}
      data-testid="verification-badge"
    >
      {/* Status badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium",
            config.className,
          )}
          data-testid={`verification-status-${result.status}`}
        >
          <Icon className="h-4 w-4" />
          {config.label}
        </span>
      </div>

      {/* Comparison summary */}
      <pre className="mb-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-900">
        <code className="text-gray-700 dark:text-gray-300">
          {result.comparison_summary}
        </code>
      </pre>

      {/* Verification method */}
      <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
        <strong>Verified by:</strong> {result.verification_method}
      </p>

      {/* Expandable details */}
      {(hasSnapshots || result.downstream_check) && (
        <div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mb-2 flex items-center gap-1 text-xs text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {isExpanded ? "Hide" : "View"} details
          </button>

          {isExpanded && (
            <div
              className="space-y-3"
              data-testid="verification-details"
            >
              {/* Before snapshot */}
              {result.before_snapshot && (
                <div>
                  <h5 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Before:
                  </h5>
                  <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <code className="text-gray-700 dark:text-gray-300">
                      {JSON.stringify(result.before_snapshot, null, 2)}
                    </code>
                  </pre>
                </div>
              )}

              {/* After snapshot */}
              {result.after_snapshot && (
                <div>
                  <h5 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    After:
                  </h5>
                  <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <code className="text-gray-700 dark:text-gray-300">
                      {JSON.stringify(result.after_snapshot, null, 2)}
                    </code>
                  </pre>
                </div>
              )}

              {/* Downstream check */}
              {result.downstream_check && (
                <div>
                  <h5 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Downstream Impact:
                  </h5>
                  <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <code className="text-gray-700 dark:text-gray-300">
                      {JSON.stringify(result.downstream_check, null, 2)}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
