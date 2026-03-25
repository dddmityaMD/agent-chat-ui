"use client";

import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Expand, Maximize2, Minimize2, X, Network, Share2 } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";

import { useBlockStore } from "@/stores/block-store";
import type { PanelBlock, SALevel } from "@/lib/panel-blocks/types";
import { SA_LEVEL_ORDER } from "@/lib/panel-blocks/constants";

/** Stable selector — returns the raw blocks record (referentially stable between renders) */
const selectBlocks = (s: { blocks: Record<string, PanelBlock> }) => s.blocks;

import { BlockRenderer } from "./block-renderer";
import { PanelEmptyState } from "./panel-empty-state";
import { LineageGraphInner } from "@/components/lineage/LineageGraphInner";
import { KnowledgeGraphButton } from "./knowledge-graph-button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SA_GROUP_LABELS: Partial<Record<SALevel, string>> = {
  l1: "Subagent",
  l2: "Context",
  l3: "Results",
};

/** Block types that support canvas-expanded views (D-14) */
const CANVAS_ELIGIBLE_TYPES = new Set([
  "evidence-collection",
  "data-profile",
  "relationships",
  "findings",
  "plan-preview",
  "artifact-list",
  "verification",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockPanelProps {
  projectName?: string;
  currentTurnId?: string;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Main panel container (D-01: single scrollable surface, no tabs).
 *
 * Reads blocks from Zustand store and renders them in SA order:
 * Action (top) -> L1 (compact, fixed container) -> L2 ("Context") -> L3 ("Results")
 *
 * Earlier turns (blocks with older turnId) are dimmed behind a divider (D-09).
 *
 * Inline lineage: "View lineage" in entity-map opens a lineage graph in the
 * bottom half of the panel (vertical split). Blocks stay visible on top.
 */
export function BlockPanel({
  projectName,
  currentTurnId,
  onCanvasOpen,
  onAction,
}: BlockPanelProps) {
  const blocks = useBlockStore(selectBlocks);
  const [lineageEntityKey, setLineageEntityKey] = useState<string | null>(null);
  const [lineageFullscreen, setLineageFullscreen] = useState(false);

  const handleLineageOpen = useCallback((entityKey: string) => {
    setLineageEntityKey(entityKey);
  }, []);

  const handleLineageClose = useCallback(() => {
    setLineageEntityKey(null);
    setLineageFullscreen(false);
  }, []);

  const toggleLineageFullscreen = useCallback(() => {
    setLineageFullscreen((v) => !v);
  }, []);

  // Derive sorted list + split into current/earlier turns (stable while blocks ref unchanged)
  const { allBlocks, currentBlocks, earlierBlocks } = useMemo(() => {
    const all = Object.values(blocks);
    const levelIndex = new Map(SA_LEVEL_ORDER.map((level, idx) => [level, idx]));
    all.sort((a, b) => {
      const levelDiff = (levelIndex.get(a.level) ?? 99) - (levelIndex.get(b.level) ?? 99);
      if (levelDiff !== 0) return levelDiff;
      return b.priority - a.priority;
    });

    if (!currentTurnId) {
      return { allBlocks: all, currentBlocks: all, earlierBlocks: [] as PanelBlock[] };
    }
    const current: PanelBlock[] = [];
    const earlier: PanelBlock[] = [];
    for (const block of all) {
      if (block.turnId && block.turnId !== currentTurnId) {
        earlier.push(block);
      } else {
        current.push(block);
      }
    }
    return { allBlocks: all, currentBlocks: current, earlierBlocks: earlier };
  }, [blocks, currentTurnId]);

  // Empty state
  if (allBlocks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
          <KnowledgeGraphButton onCanvasOpen={onCanvasOpen} />
        </div>
        <div className="flex-1">
          <PanelEmptyState projectName={projectName} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      data-testid="block-panel-content"
    >
      {/* Panel header with KG button */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
        <KnowledgeGraphButton onCanvasOpen={onCanvasOpen} />
      </div>
      {/* Blocks section — scrollable, shrinks when lineage is open */}
      <div className={`overflow-y-auto ${lineageEntityKey ? "flex-1 min-h-0" : "h-full"}`}>
        <div className="flex flex-col gap-2 p-3">
          <AnimatePresence mode="popLayout">
            {SA_LEVEL_ORDER.map((level) => {
              const blocksInLevel = currentBlocks.filter(
                (b) => b.level === level
              );
              if (blocksInLevel.length === 0) return null;

              return (
                <BlockGroup
                  key={level}
                  level={level}
                  blocks={blocksInLevel}
                  onCanvasOpen={onCanvasOpen}
                  onAction={onAction}
                  onLineageOpen={handleLineageOpen}
                />
              );
            })}
          </AnimatePresence>

          {/* Earlier turns divider (D-09) */}
          {earlierBlocks.length > 0 && (
            <>
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                  Earlier in this thread
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="opacity-60">
                <AnimatePresence mode="popLayout">
                  {SA_LEVEL_ORDER.map((level) => {
                    const blocksInLevel = earlierBlocks.filter(
                      (b) => b.level === level
                    );
                    if (blocksInLevel.length === 0) return null;

                    return (
                      <BlockGroup
                        key={`earlier-${level}`}
                        level={level}
                        blocks={blocksInLevel}
                        onCanvasOpen={onCanvasOpen}
                        onAction={onAction}
                        onLineageOpen={handleLineageOpen}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inline lineage section — bottom half of panel */}
      {lineageEntityKey && !lineageFullscreen && (
        <div className="flex flex-col border-t border-border" style={{ height: "50%" }}>
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
            <div className="flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Lineage
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLineageFullscreen}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Expand lineage"
              >
                <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={handleLineageClose}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Close lineage"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <LineageGraphInner
                rootNodeId={lineageEntityKey}
                className="h-full w-full"
              />
            </ReactFlowProvider>
          </div>
        </div>
      )}
      {lineageEntityKey && lineageFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lineage</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLineageFullscreen}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Exit fullscreen"
              >
                <Minimize2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={handleLineageClose}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Close lineage"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <LineageGraphInner
                rootNodeId={lineageEntityKey}
                className="h-full w-full"
                isFullscreen
                onToggleFullscreen={toggleLineageFullscreen}
              />
            </ReactFlowProvider>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSubagentGroup — L1 subagent blocks with expand/collapse
// ---------------------------------------------------------------------------

function CollapsibleSubagentGroup({
  label,
  blocks,
  onCanvasOpen,
  onAction,
  onLineageOpen,
}: {
  label?: string;
  blocks: PanelBlock[];
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
  onLineageOpen?: (entityKey: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-1">
      {label && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-1 px-1 group"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground/70" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground/70" />
          )}
          <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider group-hover:text-muted-foreground transition-colors">
            {label}
          </span>
        </button>
      )}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-2"
          >
            {blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                onAction={onAction}
                onCanvasOpen={onCanvasOpen}
                onLineageOpen={onLineageOpen}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockGroup — renders blocks for a single SA level
// ---------------------------------------------------------------------------

interface BlockGroupProps {
  level: SALevel;
  blocks: PanelBlock[];
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
  onLineageOpen?: (entityKey: string) => void;
}

function BlockGroup({ level, blocks, onCanvasOpen, onAction, onLineageOpen }: BlockGroupProps) {
  const label = SA_GROUP_LABELS[level];

  // L1 blocks: collapsible subagent section
  if (level === "l1") {
    return <CollapsibleSubagentGroup label={label} blocks={blocks} onCanvasOpen={onCanvasOpen} onAction={onAction} onLineageOpen={onLineageOpen} />;
  }

  // Action blocks: amber header, scale + border glow animation (250ms)
  if (level === "action") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Action Needed
          </span>
        </div>
        {blocks.map((block) => (
          <motion.div
            key={block.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              boxShadow: [
                "0 0 0 0 rgba(251, 191, 36, 0)",
                "0 0 0 3px rgba(251, 191, 36, 0.3)",
                "0 0 0 0 rgba(251, 191, 36, 0)",
              ],
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="rounded-lg"
          >
            <BlockRenderer
              block={block}
              onAction={onAction}
              onCanvasOpen={onCanvasOpen}
              onLineageOpen={onLineageOpen}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  // L2/L3 blocks: slide in from top with fade (300ms), layout for position changes
  return (
    <div className="space-y-2">
      {label && (
        <div className="px-1">
          <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            {label}
          </span>
        </div>
      )}
      {blocks.map((block) => (
        <motion.div
          key={block.id}
          layout
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative group"
        >
          <BlockRenderer
            block={block}
            onAction={onAction}
            onCanvasOpen={onCanvasOpen}
            onLineageOpen={onLineageOpen}
          />

          {/* Canvas expand affordance (D-14) */}
          {CANVAS_ELIGIBLE_TYPES.has(block.type) && onCanvasOpen && (
            <button
              onClick={() => onCanvasOpen(block.type, block.data)}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-opacity"
              title="Open in canvas"
            >
              <Expand className="w-3 h-3" />
              <span>View</span>
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );
}
