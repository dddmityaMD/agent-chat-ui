/**
 * useWorkspaceFiles hook (Phase 64-03)
 *
 * Fetches workspace files for a project and subscribes to SSE
 * workspace:file-change events for live updates.
 *
 * Returns { files, isLoading, error } from the Zustand file store.
 */

import { useEffect, useState, useCallback } from "react";
import { useFileStore } from "@/stores/file-store";
import { getApiBaseUrl } from "@/lib/api-url";
import type { FileNode } from "@/types/workspace";

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
  const { files, setFiles } = useFileStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable fetch function — called on mount and after each stream completes
  const fetchFiles = useCallback(async () => {
    if (!projectId) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files`,
        { credentials: "include" },
      );

      if (!res.ok) {
        setError(`Failed to fetch files: ${res.status}`);
        setFiles([]);
        return;
      }

      const data = await res.json();
      const tree = buildTree(data.files || []);
      setFiles(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch files");
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setFiles]);

  // Initial fetch on mount / projectId change
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Refetch after each stream completes (agent may have written files)
  useEffect(() => {
    if (!projectId) return;

    const handleStreamComplete = () => {
      fetchFiles();
    };

    window.addEventListener("stream_complete", handleStreamComplete);
    return () => {
      window.removeEventListener("stream_complete", handleStreamComplete);
    };
  }, [projectId, fetchFiles]);

  return { files, isLoading, error };
}
