/**
 * thread-header.tsx — Header components for the thread view.
 * EditableThreadTitle + ThreadCostLabel (D-16).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, Pencil } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Editable thread title displayed in the header.
 * Shows thread title (or "New conversation") and allows inline editing.
 */
export function EditableThreadTitle({
  threadId,
  title,
  preview,
  onSave,
}: {
  threadId: string | null;
  title: string | null;
  /** Fallback display text when title is empty (e.g. last_message_preview). */
  preview: string | null;
  onSave: (newTitle: string) => void;
}) {
  const displayTitle = title || (preview ? preview.slice(0, 60) : null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(displayTitle ?? "");
  }, [displayTitle]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (displayTitle ?? "")) {
      onSave(trimmed);
    }
  };

  if (!threadId) {
    return (
      <span className="text-xl font-semibold tracking-tight">SAIS DataBI</span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(displayTitle ?? "");
              setEditing(false);
            }
          }}
          className="bg-background max-w-[200px] rounded border px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-400"
          data-testid="thread-title-input"
        />
        <button
          type="button"
          onClick={commit}
          className="rounded p-0.5 hover:bg-gray-100"
          title="Save title"
        >
          <Check className="size-3.5 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="cursor-pointer truncate text-sm font-semibold tracking-tight hover:underline"
      title="Click to edit thread title"
      data-testid="thread-title"
    >
      {displayTitle || "New conversation"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ThreadCostLabel (D-16) — compact cost + token display in thread header
// ---------------------------------------------------------------------------

function formatCostCompact(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function formatTokensCompact(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

/**
 * Displays thread-level cost and token usage in the header.
 * Fetches from /api/threads/{threadId}/cost on mount and after streaming ends.
 */
export function ThreadCostLabel({
  threadId,
  isStreaming,
}: {
  threadId: string | null;
  isStreaming: boolean;
}) {
  const [cost, setCost] = useState<number | null>(null);
  const [tokens, setTokens] = useState<number | null>(null);
  const wasStreamingRef = useRef(false);

  const fetchCost = useCallback(async (tid: string) => {
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/threads/${tid}/cost`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setCost(data.total_cost_usd ?? null);
      setTokens(data.total_tokens ?? null);
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

  // Fetch on mount and when streaming ends
  useEffect(() => {
    if (!threadId) {
      setCost(null);
      setTokens(null);
      return;
    }

    if (isStreaming) {
      wasStreamingRef.current = true;
      return;
    }

    // Fetch when: first load OR streaming just ended
    if (wasStreamingRef.current || cost === null) {
      wasStreamingRef.current = false;
      fetchCost(threadId);
    }
  }, [threadId, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!threadId || (cost === null && tokens === null)) return null;

  return (
    <span
      className="text-muted-foreground whitespace-nowrap text-xs"
      data-testid="thread-cost-label"
    >
      {cost !== null && formatCostCompact(cost)}
      {cost !== null && tokens !== null && " \u00B7 "}
      {tokens !== null && `${formatTokensCompact(tokens)} tokens`}
    </span>
  );
}
