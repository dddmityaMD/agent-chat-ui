"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import type { TestConnectionResponse } from "@/hooks/useConnectorConfig";

interface ConnectorTestResultProps {
  result: TestConnectionResponse | null;
  loading: boolean;
  onDismiss: () => void;
}

export function ConnectorTestResult({
  result,
  loading,
  onDismiss,
}: ConnectorTestResultProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!loading && !result) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Testing connection...</span>
      </div>
    );
  }

  if (!result) return null;

  const isSuccess = result.success;

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        isSuccess
          ? "border-green-500/30 bg-green-500/5"
          : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className={isSuccess ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
            {result.message}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!isSuccess && result.details && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {showDetails && (
            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
              {result.details}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
