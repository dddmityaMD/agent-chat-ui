"use client";

import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export type SyncStatus = "idle" | "syncing" | "complete" | "error";

interface ConnectorSyncProgressProps {
  status: SyncStatus;
  entityCount?: number | null;
  errorMessage?: string | null;
}

export function ConnectorSyncProgress({
  status,
  entityCount,
  errorMessage,
}: ConnectorSyncProgressProps) {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "syncing" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Syncing...</span>
        </>
      )}
      {status === "complete" && (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-green-700 dark:text-green-400">
            Synced{entityCount != null ? ` ${entityCount} entities` : ""}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-700 dark:text-red-400">
            {errorMessage || "Sync failed"}
          </span>
        </>
      )}
    </div>
  );
}
