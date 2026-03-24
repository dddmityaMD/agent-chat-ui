/**
 * useWorkspaceFiles hook (Phase 64-03)
 *
 * Fetches workspace files for a project and subscribes to SSE
 * workspace:file-change events for live updates.
 *
 * Returns { files, isLoading, error } from the Zustand file store.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useFileStore } from "@/stores/file-store";
import { getApiBaseUrl } from "@/lib/api-url";
import type { FileNode, WorkspaceFileChangeEvent } from "@/types/workspace";

// ---------------------------------------------------------------------------
// Transform flat file list from API into tree structure
// ---------------------------------------------------------------------------

interface ApiFileEntry {
  path: string;
  size: number;
  modified: number;
}

function buildTree(flatFiles: ApiFileEntry[]): FileNode[] {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  // Sort so parent folders are processed before children
  const sorted = [...flatFiles].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const segments = file.path.split("/").filter(Boolean);
    const fileName = segments[segments.length - 1];

    // Ensure all parent folders exist
    let currentChildren = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const folderPath = segments.slice(0, i + 1).join("/");
      let folder = folderMap.get(folderPath);
      if (!folder) {
        folder = {
          id: folderPath,
          name: segments[i],
          path: folderPath,
          isFolder: true,
          children: [],
        };
        folderMap.set(folderPath, folder);
        currentChildren.push(folder);
        // Sort: folders first, then alphabetical
        currentChildren.sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      }
      currentChildren = folder.children!;
    }

    // Add file node
    currentChildren.push({
      id: file.path,
      name: fileName,
      path: file.path,
      isFolder: false,
      size: file.size,
      modified: file.modified,
    });
    // Sort current level
    currentChildren.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return root;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceFiles(projectId: string | null) {
  const { files, setFiles, applyFileChange } = useFileStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for SSE updates
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventsRef = useRef<WorkspaceFileChangeEvent[]>([]);

  // Flush pending SSE events
  const flushPendingEvents = useCallback(() => {
    const events = pendingEventsRef.current;
    pendingEventsRef.current = [];
    for (const event of events) {
      applyFileChange(event);
    }
  }, [applyFileChange]);

  // Fetch files from API
  useEffect(() => {
    if (!projectId) {
      setFiles([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchFiles = async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files`,
          { credentials: "include" },
        );
        if (cancelled) return;

        if (!res.ok) {
          setError(`Failed to fetch files: ${res.status}`);
          setFiles([]);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const tree = buildTree(data.files || []);
        setFiles(tree);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch files");
        setFiles([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchFiles();

    return () => {
      cancelled = true;
    };
  }, [projectId, setFiles]);

  // Subscribe to SSE workspace:file-change events
  useEffect(() => {
    if (!projectId) return;

    // Listen for custom events dispatched by the SSE stream manager
    const handleFileChange = (e: Event) => {
      const customEvent = e as CustomEvent<WorkspaceFileChangeEvent>;
      const event = customEvent.detail;
      if (!event?.operation || !event?.path) return;

      // Debounce: batch rapid events (e.g. agent writing multiple files)
      pendingEventsRef.current.push(event);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(flushPendingEvents, 200);
    };

    window.addEventListener("workspace:file-change", handleFileChange);

    return () => {
      window.removeEventListener("workspace:file-change", handleFileChange);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectId, flushPendingEvents]);

  return { files, isLoading, error };
}
