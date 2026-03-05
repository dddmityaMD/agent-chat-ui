/**
 * thread-header.tsx — Header components for the thread view.
 * EditableThreadTitle.
 */

import { useState, useRef, useEffect } from "react";
import { Check, Pencil } from "lucide-react";

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
  const displayTitle =
    title ||
    (preview ? preview.slice(0, 60) : null);
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
      <span className="text-xl font-semibold tracking-tight">
        SAIS DataBI
      </span>
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
          className="max-w-[200px] rounded border bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-400"
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
