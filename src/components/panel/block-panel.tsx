"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Expand } from "lucide-react";

import { useBlockStore } from "@/stores/block-store";
import type { PanelBlock, SALevel } from "@/lib/panel-blocks/types";
import { SA_LEVEL_ORDER } from "@/lib/panel-blocks/constants";

import { BlockRenderer } from "./block-renderer";
import { PanelEmptyState } from "./panel-empty-state";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SA_GROUP_LABELS: Partial<Record<SALevel, string>> = {
  l2: "Context",
  l3: "Results",
};

/** Block types that support canvas-expanded views (D-14) */
const CANVAS_ELIGIBLE_TYPES = new Set([
  "entity-map",
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
 */
export function BlockPanel({
  projectName,
  currentTurnId,
  onCanvasOpen,
  onAction,
}: BlockPanelProps) {
  const allBlocks = useBlockStore((s) => s.getAllBlocksSorted());

  // Split blocks into current and earlier turns
  const { currentBlocks, earlierBlocks } = useMemo(() => {
    if (!currentTurnId) {
      return { currentBlocks: allBlocks, earlierBlocks: [] as PanelBlock[] };
    }
    const current: PanelBlock[] = [];
    const earlier: PanelBlock[] = [];
    for (const block of allBlocks) {
      if (block.turnId && block.turnId !== currentTurnId) {
        earlier.push(block);
      } else {
        current.push(block);
      }
    }
    return { currentBlocks: current, earlierBlocks: earlier };
  }, [allBlocks, currentTurnId]);

  // Empty state
  if (allBlocks.length === 0) {
    return <PanelEmptyState projectName={projectName} />;
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="block-panel-content">
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
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
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
}

function BlockGroup({ level, blocks, onCanvasOpen, onAction }: BlockGroupProps) {
  const label = SA_GROUP_LABELS[level];

  // L1 blocks render in a fixed-height container so updates don't shift L2/L3
  if (level === "l1") {
    return (
      <div className="min-h-[40px]">
        {blocks.map((block) => (
          <motion.div
            key={block.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <BlockRenderer
              block={block}
              onAction={onAction}
              onCanvasOpen={onCanvasOpen}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  // Action blocks: amber header when present
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
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <BlockRenderer
              block={block}
              onAction={onAction}
              onCanvasOpen={onCanvasOpen}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  // L2/L3 blocks: subtle group header + slide-in animation
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative group"
        >
          <BlockRenderer
            block={block}
            onAction={onAction}
            onCanvasOpen={onCanvasOpen}
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
