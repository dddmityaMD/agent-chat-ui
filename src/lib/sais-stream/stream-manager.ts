/**
 * Core state machine that processes SSE events and manages stream state.
 *
 * Simplified for REST-based message architecture (Phase 23.4):
 * - SSE carries only sais_ui updates and "new message available" signals
 * - Messages are fetched via REST (useMessages hook), NOT extracted from SSE
 * - messagesCache, merge-on-shrink, subgraph message extraction: DELETED
 * - preStreamIds tracking: DELETED
 *
 * Kept:
 * - SSE connection management (connect, disconnect, reconnect)
 * - sais_ui extraction from values events (for live stepper)
 * - Stream lifecycle events (start, end, error)
 * - Interrupt state detection from SSE
 */

import type { Message } from "@langchain/langgraph-sdk";
import type { SSEEvent } from "./sse-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaisStreamState {
  values: Record<string, unknown> | null;
  isLoading: boolean;
  error: Error | null;
  runId: string | null;
}

export type StateListener = (state: SaisStreamState) => void;

// ---------------------------------------------------------------------------
// Stream Manager
// ---------------------------------------------------------------------------

export class SaisStreamManager {
  private _state: SaisStreamState = {
    values: null,
    isLoading: false,
    error: null,
    runId: null,
  };

  /** sais_ui cache that persists across stream->idle transitions */
  private saisUiCache: Record<string, unknown> | null = null;

  /** Last known message count for detecting new messages in SSE events */
  private lastKnownMessageCount = 0;

  /** Current abort controller for the active stream */
  private abortController: AbortController | null = null;

  /** Callback for custom events */
  onCustomEvent?: (data: unknown, namespace?: string[]) => void;

  /** Callback when SSE signals new messages are available (triggers REST fetch) */
  onNewMessageSignal?: () => void;

  /** Listeners for state changes */
  private listeners: Set<StateListener> = new Set();

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get state(): SaisStreamState {
    return this._state;
  }

  /**
   * Get values with sais_ui cache fallback.
   * When values is null/empty (stream->idle gap), merges cached sais_ui.
   */
  get values(): Record<string, unknown> | null {
    const v = this._state.values;
    if (!v) {
      // Stream->idle gap: return cached sais_ui if available
      if (this.saisUiCache) {
        return { sais_ui: this.saisUiCache } as Record<string, unknown>;
      }
      return null;
    }

    // Merge sais_ui cache fallback when current values lack sais_ui
    const currentSaisUi = v.sais_ui as Record<string, unknown> | undefined;
    if ((!currentSaisUi || Object.keys(currentSaisUi).length === 0) && this.saisUiCache) {
      return { ...v, sais_ui: this.saisUiCache };
    }

    return v;
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start consuming events from an async generator.
   */
  async start(
    runFn: (signal: AbortSignal) => AsyncGenerator<SSEEvent>,
  ): Promise<void> {
    // Abort previous stream if any
    this.stop();

    this.abortController = new AbortController();
    this.updateState({ isLoading: true, error: null });

    try {
      const generator = runFn(this.abortController.signal);

      for await (const event of generator) {
        if (this.abortController.signal.aborted) break;
        this.processEvent(event.event, event.data);
      }
    } catch (err) {
      if (!this.abortController?.signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.updateState({ error });
      }
    } finally {
      this.updateState({ isLoading: false });
      this.abortController = null;
      // Signal a final message fetch when stream ends (catches any last messages)
      this.onNewMessageSignal?.();
    }
  }

  /**
   * Stop the current stream.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Clear all state (e.g., on thread switch).
   */
  clear(): void {
    this.stop();
    this.saisUiCache = null;
    this.lastKnownMessageCount = 0;
    this._state = {
      values: null,
      isLoading: false,
      error: null,
      runId: null,
    };
    this.notify();
  }

  /**
   * Set values directly (e.g., from thread state fetch on mount).
   */
  setValues(values: Record<string, unknown>): void {
    this._state.values = values;
    // Update sais_ui cache
    // eslint-disable-next-line no-restricted-syntax -- stream manager IS the sais_ui source
    const saisUi = values.sais_ui as Record<string, unknown> | undefined;
    if (saisUi && typeof saisUi === "object" && Object.keys(saisUi).length > 0) {
      this.saisUiCache = saisUi;
    }
    // Track message count for new-message detection
    const messages = values.messages as Message[] | undefined;
    if (messages) {
      this.lastKnownMessageCount = messages.length;
    }
    this.notify();
  }

  /**
   * Apply optimistic values update before stream starts.
   */
  applyOptimistic(
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ): void {
    const prev = this._state.values ?? {};
    this._state.values = updater(prev);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Event processing
  // -----------------------------------------------------------------------

  private processEvent(event: string, data: unknown): void {
    // Extract namespace from event name (e.g., "values|subgraph_name")
    const namespace = event.includes("|") ? event.split("|").slice(1) : undefined;

    // Error events
    if (event === "error") {
      const msg = data && typeof data === "object" && "message" in data
        ? (data as { message: string }).message
        : "Stream error";
      this.updateState({ error: new Error(msg) });
      return;
    }

    // Metadata (run_id)
    if (event === "metadata") {
      const runId = data && typeof data === "object" && "run_id" in data
        ? (data as { run_id: string }).run_id
        : null;
      this.updateState({ runId });
      return;
    }

    // PARENT values -- extract sais_ui, detect new messages
    if (event === "values") {
      const newValues = data as Record<string, unknown>;
      if (newValues?.__interrupt__) {
        // Interrupt: merge with existing values to preserve state
        this._state.values = { ...this._state.values, ...newValues };
      } else {
        this._state.values = newValues;
      }
      this.updateSaisUiCache();
      this.checkForNewMessages(newValues);
      this.notify();
      return;
    }

    // SUBGRAPH values -- extract sais_ui and detect new messages (SDK DROPS THESE)
    if (event.startsWith("values|")) {
      const subState = data as Record<string, unknown>;
      let changed = false;

      // Extract sais_ui
      // eslint-disable-next-line no-restricted-syntax -- stream manager IS the sais_ui source
      if (subState?.sais_ui && typeof subState.sais_ui === "object") {
        // eslint-disable-next-line no-restricted-syntax -- stream manager IS the sais_ui source
        const currentSaisUi = (this._state.values?.sais_ui ?? {}) as Record<string, unknown>;
        const merged = { ...currentSaisUi, ...(subState.sais_ui as Record<string, unknown>) };
        this._state.values = {
          ...(this._state.values ?? {}),
          sais_ui: merged,
        };
        this.saisUiCache = merged;
        changed = true;
      }

      // Check for new messages signal (don't extract messages, just detect count change)
      this.checkForNewMessages(subState);

      if (changed) this.notify();
      return;
    }

    // Custom events
    if (event === "custom" || event.startsWith("custom|")) {
      this.onCustomEvent?.(data, namespace);
      return;
    }

    // Messages/complete events -- no-op
    if (event === "end" || event === "done") {
      return;
    }
  }

  /**
   * Check if SSE event contains more messages than last known count.
   * If so, signal the REST message fetcher to refetch.
   */
  private checkForNewMessages(values: Record<string, unknown> | null): void {
    if (!values) return;
    const msgs = values.messages as Message[] | undefined;
    if (msgs && msgs.length > this.lastKnownMessageCount) {
      this.lastKnownMessageCount = msgs.length;
      this.onNewMessageSignal?.();
    }
  }

  private updateSaisUiCache(): void {
    if (!this._state.values) return;

    // Update sais_ui cache
    // eslint-disable-next-line no-restricted-syntax -- stream manager IS the sais_ui source
    const saisUi = this._state.values.sais_ui as Record<string, unknown> | undefined;
    if (saisUi && typeof saisUi === "object" && Object.keys(saisUi).length > 0) {
      this.saisUiCache = saisUi;
    }
  }

  private updateState(partial: Partial<SaisStreamState>): void {
    Object.assign(this._state, partial);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this._state);
      } catch (err) {
        console.error("[SaisStreamManager] Listener error:", err);
      }
    }
  }
}
