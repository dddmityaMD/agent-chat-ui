"use client";

/**
 * Sidebar tabs: Threads / Files (Phase 64-03, WS-04).
 *
 * Wraps the existing thread list and the new file tree into a
 * tabbed sidebar using Radix UI Tabs (already installed).
 *
 * The Threads tab shows the thread list (existing behavior).
 * The Files tab shows the workspace file browser.
 */

import React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { MessageSquare, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileTree } from "@/components/file-browser/file-tree";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarTabsProps {
  /** The existing thread list content (passed as children) */
  threadsContent: React.ReactNode;
  /** Currently selected project ID for file tree */
  projectId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SidebarTabs({ threadsContent, projectId }: SidebarTabsProps) {
  return (
    <Tabs.Root defaultValue="threads" className="flex h-full flex-col">
      {/* Tab triggers */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-700">
        <Tabs.List className="grid w-full grid-cols-2">
          <Tabs.Trigger
            value="threads"
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground",
              "data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600",
              "dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Threads
          </Tabs.Trigger>
          <Tabs.Trigger
            value="files"
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground",
              "data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600",
              "dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400",
            )}
          >
            <FolderTree className="h-3.5 w-3.5" />
            Files
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      {/* Thread list tab */}
      <Tabs.Content value="threads" className="flex-1 overflow-hidden">
        {threadsContent}
      </Tabs.Content>

      {/* Files tab */}
      <Tabs.Content value="files" className="flex-1 overflow-hidden">
        <FileTree projectId={projectId} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
