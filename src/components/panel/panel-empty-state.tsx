"use client";

import { Database, MessageSquare } from "lucide-react";

interface PanelEmptyStateProps {
  projectName?: string;
}

/**
 * Empty panel state shown when no blocks exist (new thread).
 * Shows contextual welcome message with project name if available.
 */
export function PanelEmptyState({ projectName }: PanelEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted">
        <Database className="w-6 h-6 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">
          {projectName
            ? `Working on ${projectName}`
            : "Ask about your data to start exploring"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          {projectName
            ? "Start a conversation to see structured results here"
            : "Entities, evidence, plans, and progress will appear here as the agent works"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Panel updates as the agent works</span>
      </div>
    </div>
  );
}
