/**
 * REST client for LangGraph thread operations (non-streaming).
 *
 * Handles thread CRUD, state retrieval, history fetching, and message fetching.
 * All requests use `credentials: "include"` for cookie forwarding.
 */

import type { Message } from "@langchain/langgraph-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadState {
  values: Record<string, unknown>;
  next: string[];
  checkpoint: {
    thread_id: string;
    checkpoint_id: string;
    checkpoint_ns: string;
  };
  parent_checkpoint?: {
    thread_id: string;
    checkpoint_id: string;
    checkpoint_ns: string;
  } | null;
  tasks: Array<{
    id: string;
    name: string;
    interrupts?: unknown[];
  }>;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class SaisThreadClient {
  private apiUrl: string;
  private fetchImpl: typeof fetch;

  constructor(apiUrl: string, fetchImpl?: typeof fetch) {
    this.apiUrl = apiUrl;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /**
   * Create a new thread.
   */
  async createThread(
    metadata?: Record<string, unknown>,
  ): Promise<{ thread_id: string }> {
    const body: Record<string, unknown> = {};
    if (metadata) body.metadata = metadata;

    const response = await this.fetchImpl(`${this.apiUrl}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Create thread failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get the current state of a thread.
   */
  async getState(threadId: string): Promise<ThreadState> {
    const response = await this.fetchImpl(
      `${this.apiUrl}/threads/${threadId}/state`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error(`Get state failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get the state history of a thread (for branching).
   */
  async getHistory(
    threadId: string,
    limit?: number,
  ): Promise<ThreadState[]> {
    const body: Record<string, unknown> = {};
    if (limit !== undefined) body.limit = limit;

    const response = await this.fetchImpl(
      `${this.apiUrl}/threads/${threadId}/history`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Get history failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch messages for a thread via REST (GET /threads/{id}/state).
   * Uses cache-busting parameter to avoid stale reads (Pitfall 1).
   * Supports AbortSignal for cancellation on thread switch (Pitfall 2).
   */
  async fetchMessages(
    threadId: string,
    signal?: AbortSignal,
  ): Promise<Message[]> {
    const response = await this.fetchImpl(
      `${this.apiUrl}/threads/${threadId}/state?t=${Date.now()}`,
      {
        method: "GET",
        credentials: "include",
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Fetch messages failed: ${response.status}`);
    }

    const state: ThreadState = await response.json();
    return (state.values?.messages as Message[] | undefined) ?? [];
  }

  /**
   * Check if the LangGraph server is accessible.
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.apiUrl}/info`, {
        method: "GET",
        credentials: "include",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
