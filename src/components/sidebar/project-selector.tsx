"use client";

/**
 * Compact project selector for the sidebar (D-07, Phase 49-07).
 *
 * Shows current project name with a dropdown to switch projects.
 * Sits above the thread list in the sidebar navigation.
 *
 * Data source: GET /api/workspace/projects
 */

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  FolderOpen,
  Loader2,
  Plus,
  Check,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectSelectorProps {
  /** Callback when a project is selected */
  onProjectSelect?: (project: { id: string; name: string } | null) => void;
  /** Currently selected project ID (controlled) */
  selectedProjectId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectSelector({
  onProjectSelect,
  selectedProjectId: controlledId,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedId = controlledId ?? internalSelectedId;

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
      data.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setProjects(data);

      // Auto-select default project if none selected
      if (!selectedId) {
        const defaultProject = data.find((p) => p.is_default);
        if (defaultProject) {
          setInternalSelectedId(defaultProject.id);
          onProjectSelect?.({ id: defaultProject.id, name: defaultProject.name });
        }
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setShowNewProject(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const handleSelect = (project: Project) => {
    setInternalSelectedId(project.id);
    onProjectSelect?.({ id: project.id, name: project.name });
    setDropdownOpen(false);
  };

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
      handleSelect(created);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedId);
  const displayName = selectedProject?.name ?? "No project";

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-2" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((p) => !p)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          "hover:bg-muted/50 border border-transparent",
          dropdownOpen && "bg-muted/50 border-border",
        )}
        data-testid="project-selector-trigger"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1 truncate text-left font-medium">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            dropdownOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-md border bg-white shadow-lg dark:bg-zinc-900">
          <div className="max-h-48 overflow-y-auto py-1">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                  selectedId === project.id
                    ? "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    : "hover:bg-muted/50",
                )}
                onClick={() => handleSelect(project)}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-left">{project.name}</span>
                {project.is_default && (
                  <span className="text-xs text-blue-600">(default)</span>
                )}
                {selectedId === project.id && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                )}
              </button>
            ))}
          </div>

          {/* New project */}
          <div className="border-t px-2 py-1.5">
            {showNewProject ? (
              <div className="flex items-center gap-1.5">
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
                  className="flex-1 rounded border bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  disabled={creating}
                />
                <button
                  type="button"
                  onClick={handleCreateProject}
                  disabled={creating || !newProjectName.trim()}
                  className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:text-muted-foreground"
                >
                  {creating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                onClick={() => setShowNewProject(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New project</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
