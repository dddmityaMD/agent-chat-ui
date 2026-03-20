"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  File,
  ExternalLink,
  Plus,
  Pencil,
} from "lucide-react";

import type {
  PanelBlock,
  BlockState,
  ArtifactListData,
} from "@/lib/panel-blocks/types";

// ---------------------------------------------------------------------------
// File icon mapping
// ---------------------------------------------------------------------------

const LANGUAGE_ICONS: Record<string, React.ElementType> = {
  sql: FileCode2,
  python: FileCode2,
  yaml: FileText,
  yml: FileText,
  json: FileText,
  markdown: FileText,
  md: FileText,
};

function getFileIcon(language?: string) {
  if (!language) return File;
  return LANGUAGE_ICONS[language.toLowerCase()] ?? File;
}

// ---------------------------------------------------------------------------
// Operation badge
// ---------------------------------------------------------------------------

function OperationBadge({ operation }: { operation: string }) {
  const isNew = operation === "new" || operation === "created";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded ${
        isNew
          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
      }`}
    >
      {isNew ? (
        <Plus className="w-2.5 h-2.5" />
      ) : (
        <Pencil className="w-2.5 h-2.5" />
      )}
      {isNew ? "new" : "modified"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ArtifactListBlockProps {
  block: PanelBlock;
  state: BlockState;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * L3 artifact-list block: files created/modified with status, line count,
 * and canvas expand affordance for code preview (D-14, D-15).
 *
 * Persistent & accumulative (D-10).
 */
export function ArtifactListBlock({
  block,
  state,
  onCanvasOpen,
}: ArtifactListBlockProps) {
  const data = block.data as ArtifactListData | undefined;
  const [expanded, setExpanded] = useState(false);

  // Loading
  if (state === "loading" || !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const artifacts = data.artifacts ?? [];
  const newCount = artifacts.filter(
    (a) => a.operation === "new" || a.operation === "created"
  ).length;
  const modCount = artifacts.length - newCount;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Artifacts
        </span>
        <span className="text-xs text-muted-foreground/60">
          {newCount > 0 && `${newCount} new`}
          {newCount > 0 && modCount > 0 && ", "}
          {modCount > 0 && `${modCount} modified`}
        </span>
      </button>

      {/* Compact: file list */}
      {!expanded && (
        <p className="text-xs text-foreground mt-1.5 ml-5 truncate">
          {artifacts
            .slice(0, 3)
            .map((a) => a.path.split("/").pop())
            .join(", ")}
          {artifacts.length > 3 && ` +${artifacts.length - 3}`}
        </p>
      )}

      {/* Expanded: full file cards */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {artifacts.map((artifact, idx) => {
            const Icon = getFileIcon(artifact.language);
            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground font-mono text-[11px] truncate">
                  {artifact.path}
                </span>
                <OperationBadge operation={artifact.operation} />
                {artifact.line_count != null && (
                  <span className="text-muted-foreground/50 flex-shrink-0">
                    {artifact.line_count}L
                  </span>
                )}
                {/* Canvas afford for code preview (D-14, D-15) */}
                {onCanvasOpen && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCanvasOpen("code", artifact);
                    }}
                    className="ml-auto text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                    title="View code"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
