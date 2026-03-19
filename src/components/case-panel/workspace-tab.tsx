"use client";

/**
 * Workspace tab - Dual mode:
 *
 * Mode 1 (no thread): Project selector — list projects, select one, Start thread.
 * Mode 2 (thread active): Project file tree — shows workspace files from project-scoped API.
 *
 * Data sources:
 *   Mode 1: GET /api/workspace/projects (list), POST /api/workspace/projects (create)
 *   Mode 2: GET /api/workspace/projects/{id}/files (file listing)
 *           GET /api/workspace/projects/{id}/files/content?path=... (file content)
 *   Fallback: GET /api/threads/{thread_id}/workspace (thread-scoped, backward compat)
 */

import React, { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Folder, Loader2, Plus, Check } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import type { Project, ThreadWithMeta } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceFile {
  path: string;
  size: number;
  modified: number;
  is_dir?: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string | null; // null for directories
  children: TreeNode[];
}

interface WorkspaceTabProps {
  threadId?: string | null;
  refreshKey?: number;
  onStartThread: (projectId: string) => Promise<void>;
  currentThread?: ThreadWithMeta | null;
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

/** Build a tree structure from flat file paths */
function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode = { name: "", fullPath: null, children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: isFile ? file.path : null,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      const aIsDir = a.children.length > 0;
      const bIsDir = b.children.length > 0;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      sortTree(node.children);
    }
  }

  sortTree(root.children);
  return root.children;
}

// ---------------------------------------------------------------------------
// Tree Node component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.children.length > 0;
  const isSelected = node.fullPath === selectedFile;

  if (isDir) {
    return (
      <div>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1.5 py-0.5 text-xs hover:bg-muted/50 rounded px-1",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.fullPath ?? child.name}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 py-0.5 text-xs rounded px-1",
        isSelected
          ? "bg-blue-100 text-blue-800"
          : "hover:bg-muted/50 text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => node.fullPath && onSelectFile(node.fullPath)}
    >
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mode 1: Project Selector
// ---------------------------------------------------------------------------

function ProjectSelector({
  onStartThread,
}: {
  onStartThread: (projectId: string) => Promise<void>;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/workspace/projects`, {
        credentials: "include",
      });
      if (!res.ok) {
        setProjects([]);
        return;
      }
      const data: Project[] = await res.json();
      // Sort: is_default first, then alphabetically
      data.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setProjects(data);
      // Auto-select the default project
      const defaultProject = data.find((p) => p.is_default);
      if (defaultProject && !selectedProjectId) {
        setSelectedProjectId(defaultProject.id);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/workspace/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
        credentials: "include",
      });
      if (!res.ok) return;
      const created: Project = await res.json();
      setNewProjectName("");
      setShowNewProject(false);
      await fetchProjects();
      setSelectedProjectId(created.id);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async () => {
    if (!selectedProjectId) return;
    setStarting(true);
    try {
      await onStartThread(selectedProjectId);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading projects...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Select a project
        </div>

        <div className="space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                selectedProjectId === project.id
                  ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                  : "hover:bg-muted/50",
              )}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 text-left">
                <div className="font-medium">{project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {project.thread_count} thread{project.thread_count !== 1 ? "s" : ""}
                  {project.is_default && (
                    <span className="ml-1 text-blue-600">(default)</span>
                  )}
                </div>
              </div>
              {selectedProjectId === project.id && (
                <Check className="h-4 w-4 text-blue-600 shrink-0" />
              )}
            </button>
          ))}

          {/* New project row */}
          {showNewProject ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                  if (e.key === "Escape") {
                    setShowNewProject(false);
                    setNewProjectName("");
                  }
                }}
                placeholder="Project name"
                className="flex-1 bg-transparent text-sm outline-none"
                autoFocus
                disabled={creating}
              />
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={creating || !newProjectName.trim()}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium",
                  creating || !newProjectName.trim()
                    ? "text-muted-foreground"
                    : "text-blue-600 hover:bg-blue-50",
                )}
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
              onClick={() => setShowNewProject(true)}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New project</span>
            </button>
          )}
        </div>
      </div>

      {/* Start thread button */}
      <div className="border-t p-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedProjectId || starting}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            !selectedProjectId || starting
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700",
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start thread"
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 2: Project File Tree
// ---------------------------------------------------------------------------

function ProjectFileTree({
  projectId,
  projectName,
  threadId,
  refreshKey,
}: {
  projectId: string | null;
  projectName: string | null;
  threadId: string;
  refreshKey?: number;
}) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch file listing — project-scoped or thread-scoped fallback
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (projectId) {
        url = `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files`;
      } else {
        // Backward compat: fall back to thread-scoped workspace
        url = `${getApiBaseUrl()}/api/threads/${threadId}/workspace`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        setFiles([]);
        return;
      }
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, threadId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  // Fetch file content when selectedFile changes
  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      return;
    }

    let cancelled = false;
    setContentLoading(true);

    let url: string;
    if (projectId) {
      url = `${getApiBaseUrl()}/api/workspace/projects/${projectId}/files/content?path=${encodeURIComponent(selectedFile)}`;
    } else {
      url = `${getApiBaseUrl()}/api/threads/${threadId}/workspace/file?path=${encodeURIComponent(selectedFile)}`;
    }

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFileContent(data.content ?? "");
      })
      .catch(() => {
        if (!cancelled) setFileContent("Failed to load file content.");
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, threadId, selectedFile]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      {projectName && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium truncate">{projectName}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No workspace files yet.
        </div>
      ) : (
        <>
          {/* File tree */}
          <div className="max-h-[40%] overflow-y-auto border-b p-2">
            {buildTree(files).map((node) => (
              <TreeNodeItem
                key={node.fullPath ?? node.name}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
            ))}
          </div>

          {/* File viewer */}
          <div className="flex-1 overflow-y-auto p-3">
            {contentLoading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : fileContent !== null ? (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground truncate">
                  {selectedFile}
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded border bg-muted/30 p-2.5">
                  <code>{fileContent}</code>
                </pre>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Select a file to view its contents.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceTab — Dual Mode
// ---------------------------------------------------------------------------

export function WorkspaceTab({ threadId, refreshKey, onStartThread, currentThread }: WorkspaceTabProps) {
  if (!threadId) {
    // Mode 1: Project selector
    return <ProjectSelector onStartThread={onStartThread} />;
  }

  // Mode 2: Project file tree
  return (
    <ProjectFileTree
      projectId={currentThread?.project_id ?? null}
      projectName={currentThread?.project_name ?? null}
      threadId={threadId}
      refreshKey={refreshKey}
    />
  );
}
