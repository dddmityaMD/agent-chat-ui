import { useState, useMemo } from "react";
import type { ThreadWithMeta } from "@/lib/types";

/**
 * Client-side thread search/filter hook.
 *
 * Filters threads by title and preview text, hides archived threads by default,
 * and sorts pinned-first then reverse-chronological by last_activity_at.
 */
export function useThreadSearch(threads: ThreadWithMeta[]) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    let result = threads;
    if (!showArchived) result = result.filter((t) => !t.is_archived);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.last_message_preview?.toLowerCase().includes(q),
      );
    }
    // Sort: pinned first, then by last_activity_at DESC
    return result.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (
        new Date(b.last_activity_at).getTime() -
        new Date(a.last_activity_at).getTime()
      );
    });
  }, [threads, query, showArchived]);

  return { query, setQuery, showArchived, setShowArchived, filtered };
}
