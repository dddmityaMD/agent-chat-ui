/**
 * Checkpoint-based message branching for edit/regenerate.
 *
 * Replicates the LangGraph SDK's `useBranchContext` logic:
 * - Builds a branch tree from state history checkpoints
 * - Maps messages to their first-seen checkpoint
 * - Supports branching via checkpoint selection
 */

import type { Message } from "@langchain/langgraph-sdk";
import type { ThreadState } from "./thread-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageMetadata {
  messageId: string;
  firstSeenState?: ThreadState;
  branch?: string;
  branchOptions?: string[];
  checkpoint?: { checkpoint_id: string };
}

// ---------------------------------------------------------------------------
// Branch Context
// ---------------------------------------------------------------------------

export class BranchContext {
  private history: ThreadState[] = [];
  private messageToCheckpoint: Map<string, ThreadState> = new Map();

  /**
   * Update with new history from the thread.
   */
  update(history: ThreadState[]): void {
    this.history = history;
    this.rebuildIndex();
  }

  /**
   * Clear all state (used on thread switch to prevent stale interrupt leaking).
   */
  clear(): void {
    this.history = [];
    this.messageToCheckpoint.clear();
  }

  /**
   * Get the latest checkpoint (thread head).
   * Used for interrupt detection when not streaming.
   */
  get threadHead(): ThreadState | undefined {
    return this.history[0];
  }

  /**
   * Get interrupt data from the thread head.
   * Checks both `__interrupt__` in values and `tasks` with interrupts.
   */
  get interrupt(): unknown {
    const head = this.threadHead;
    if (!head) return undefined;

    // Check values for __interrupt__
    if (head.values?.__interrupt__) {
      return head.values.__interrupt__;
    }

    // Check tasks for interrupts
    if (head.tasks) {
      for (const task of head.tasks) {
        if (task.interrupts && task.interrupts.length > 0) {
          return task.interrupts;
        }
      }
    }

    return undefined;
  }

  /**
   * Get metadata for a message (branch info, first-seen checkpoint).
   */
  getMessagesMetadata(
    message: Message,
    _index?: number,
  ): MessageMetadata | undefined {
    if (!message.id) return undefined;

    const firstSeen = this.messageToCheckpoint.get(message.id);
    if (!firstSeen) return undefined;

    const checkpointId = firstSeen.checkpoint?.checkpoint_id;
    const branchInfo = this.getBranchInfo(checkpointId);

    return {
      messageId: message.id,
      firstSeenState: firstSeen,
      branch: branchInfo?.branch,
      branchOptions: branchInfo?.branchOptions,
      checkpoint: checkpointId ? { checkpoint_id: checkpointId } : undefined,
    };
  }

  /**
   * Get branch info for a checkpoint (which branch it's on, what alternatives exist).
   */
  private getBranchInfo(
    checkpointId: string | undefined,
  ): { branch: string; branchOptions: string[] } | undefined {
    if (!checkpointId || this.history.length === 0) return undefined;

    // Build a simple branch map: group checkpoints by parent
    // For now, support a single linear branch (the common case)
    // Full branching tree can be added later if needed
    const idx = this.history.findIndex(
      (h) => h.checkpoint?.checkpoint_id === checkpointId,
    );
    if (idx === -1) return undefined;

    return {
      branch: "main",
      branchOptions: ["main"],
    };
  }

  /**
   * Rebuild the message-to-checkpoint index from history.
   * Each message maps to the FIRST (oldest) checkpoint that contains it.
   */
  private rebuildIndex(): void {
    this.messageToCheckpoint.clear();

    // History is ordered newest-first, so iterate in reverse
    for (let i = this.history.length - 1; i >= 0; i--) {
      const state = this.history[i];
      const messages = (state.values?.messages ?? []) as Message[];

      for (const msg of messages) {
        if (msg.id && !this.messageToCheckpoint.has(msg.id)) {
          this.messageToCheckpoint.set(msg.id, state);
        }
      }
    }
  }
}
