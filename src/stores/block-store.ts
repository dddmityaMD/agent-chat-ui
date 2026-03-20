/**
 * Zustand Block Store (Phase 49-01)
 *
 * Manages SA-layered panel blocks. Accepts both direct upserts
 * and D-18 block_update SSE events via applyBlockUpdate().
 *
 * Uses Record<string, PanelBlock> (not Map) for Zustand persist compatibility.
 */

import { create } from "zustand";

import type {
  PanelBlock,
  SALevel,
  BlockUpdateEvent,
} from "@/lib/panel-blocks/types";
import { SA_LEVEL_ORDER } from "@/lib/panel-blocks/constants";

// ---------------------------------------------------------------------------
// Thread summary shape (for cold-start hydration from REST API)
// ---------------------------------------------------------------------------

export interface ThreadSummary {
  entities?: Array<{
    name: string;
    type: string;
    confidence: number;
    resolved: boolean;
  }>;
  evidence?: Array<{
    source: string;
    tool_name: string;
    finding: string;
    quality_flag: string;
  }>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface BlockStore {
  threadId: string | null;
  blocks: Record<string, PanelBlock>;

  // Selectors
  getBlocksByLevel: (level: SALevel) => PanelBlock[];
  getActionBlocks: () => PanelBlock[];
  getAllBlocksSorted: () => PanelBlock[];

  // Mutations
  upsertBlock: (block: PanelBlock) => void;
  removeBlock: (id: string) => void;
  updateBlockData: (id: string, partialData: Record<string, unknown>) => void;
  applyBlockUpdate: (event: BlockUpdateEvent) => void;

  // Thread lifecycle
  switchThread: (threadId: string | null) => void;
  hydrateFromSummary: (threadId: string, summary: ThreadSummary) => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useBlockStore = create<BlockStore>()((set, get) => ({
  threadId: null,
  blocks: {},

  // --- Selectors -----------------------------------------------------------

  getBlocksByLevel(level: SALevel): PanelBlock[] {
    const { blocks } = get();
    return Object.values(blocks)
      .filter((b) => b.level === level)
      .sort((a, b) => b.priority - a.priority);
  },

  getActionBlocks(): PanelBlock[] {
    return get().getBlocksByLevel("action");
  },

  getAllBlocksSorted(): PanelBlock[] {
    const { blocks } = get();
    const allBlocks = Object.values(blocks);

    // Group by SA level order, then sort by priority within each group
    const levelIndex = new Map(
      SA_LEVEL_ORDER.map((level, idx) => [level, idx]),
    );

    return allBlocks.sort((a, b) => {
      const levelDiff =
        (levelIndex.get(a.level) ?? 99) - (levelIndex.get(b.level) ?? 99);
      if (levelDiff !== 0) return levelDiff;
      return b.priority - a.priority; // higher priority first
    });
  },

  // --- Mutations ------------------------------------------------------------

  upsertBlock(block: PanelBlock): void {
    set((state) => ({
      blocks: {
        ...state.blocks,
        [block.id]: { ...block, updatedAt: Date.now() },
      },
    }));
  },

  removeBlock(id: string): void {
    set((state) => {
      const { [id]: _, ...rest } = state.blocks;
      return { blocks: rest };
    });
  },

  updateBlockData(id: string, partialData: Record<string, unknown>): void {
    set((state) => {
      const existing = state.blocks[id];
      if (!existing) return state;

      const existingData =
        existing.data && typeof existing.data === "object"
          ? (existing.data as Record<string, unknown>)
          : {};

      return {
        blocks: {
          ...state.blocks,
          [id]: {
            ...existing,
            data: { ...existingData, ...partialData },
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  applyBlockUpdate(event: BlockUpdateEvent): void {
    if (event.action === "remove") {
      get().removeBlock(event.block_id);
      return;
    }

    // action === "upsert"
    const existing = get().blocks[event.block_id];
    const block: PanelBlock = {
      id: event.block_id,
      type: event.block_id, // block_id doubles as type for SSE-originated blocks
      level: event.sa_level,
      data: event.data,
      priority: existing?.priority ?? 0.5,
      state: "populated",
      updatedAt: Date.now(),
      ...(existing
        ? { turnId: existing.turnId }
        : {}),
    };

    set((state) => ({
      blocks: { ...state.blocks, [block.id]: block },
    }));
  },

  // --- Thread lifecycle -----------------------------------------------------

  switchThread(threadId: string | null): void {
    set({ threadId, blocks: {} });
  },

  hydrateFromSummary(threadId: string, summary: ThreadSummary): void {
    const blocks: Record<string, PanelBlock> = {};
    const now = Date.now();

    if (summary.entities && summary.entities.length > 0) {
      blocks["entity-map"] = {
        id: "entity-map",
        type: "entity-map",
        level: "l2",
        data: { entities: summary.entities },
        priority: 0.8,
        state: "complete",
        updatedAt: now,
      };
    }

    if (summary.evidence && summary.evidence.length > 0) {
      blocks["evidence-collection"] = {
        id: "evidence-collection",
        type: "evidence-collection",
        level: "l2",
        data: { items: summary.evidence, count: summary.evidence.length },
        priority: 0.7,
        state: "complete",
        updatedAt: now,
      };
    }

    set({ threadId, blocks });
  },
}));
