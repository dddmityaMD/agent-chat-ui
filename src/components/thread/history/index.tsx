import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useThreads } from "@/providers/Thread";
import { useThreadSearch } from "@/hooks/useThreadSearch";
import type { ThreadWithMeta } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PanelRightOpen,
  PanelRightClose,
  Plus,
  Search,
  Pin,
  PinOff,
  MoreVertical,
  Archive,
  Pencil,
  Loader2,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useActiveRuns } from "@/providers/ActiveRuns";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Thread kebab / context menu (lightweight, no Radix DropdownMenu needed)
// ---------------------------------------------------------------------------

function ThreadContextMenu({
  thread,
  onRename,
  onTogglePin,
  onArchive,
}: {
  thread: ThreadWithMeta;
  onRename: (threadId: string) => void;
  onTogglePin: (threadId: string, isPinned: boolean) => void;
  onArchive: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((prev) => !prev);
  };

  const dropdown = open ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] w-40 rounded-md border bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      style={{ top: menuPos.top, left: menuPos.left }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          onRename(thread.thread_id);
        }}
      >
        <Pencil className="size-3.5" />
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          onTogglePin(thread.thread_id, thread.is_pinned);
        }}
      >
        {thread.is_pinned ? (
          <>
            <PinOff className="size-3.5" />
            Unpin
          </>
        ) : (
          <>
            <Pin className="size-3.5" />
            Pin
          </>
        )}
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-700"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          onArchive(thread.thread_id);
        }}
      >
        <Archive className="size-3.5" />
        Archive
      </button>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="rounded p-1 text-muted-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700"
        aria-label="Thread actions"
      >
        <MoreVertical className="size-4" />
      </button>
      {dropdown}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread list entry
// ---------------------------------------------------------------------------

function ThreadEntry({
  thread,
  isActive,
  onClick,
  onRename,
  onTogglePin,
  onArchive,
}: {
  thread: ThreadWithMeta;
  isActive: boolean;
  onClick: () => void;
  onRename: (threadId: string) => void;
  onTogglePin: (threadId: string, isPinned: boolean) => void;
  onArchive: (threadId: string) => void;
}) {
  const { getActiveRun } = useActiveRuns();
  const isRunning = !!getActiveRun(thread.thread_id);

  const displayTitle =
    thread.title ||
    (thread.last_message_preview
      ? thread.last_message_preview.slice(0, 60)
      : thread.thread_id.slice(0, 8));

  const relativeTime = formatDistanceToNow(new Date(thread.last_activity_at), {
    addSuffix: true,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors ${
        isActive
          ? "bg-slate-200 dark:bg-slate-700"
          : "hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {/* Context menu (left side) */}
      <ThreadContextMenu
        thread={thread}
        onRename={onRename}
        onTogglePin={onTogglePin}
        onArchive={onArchive}
      />

      {/* Pin indicator */}
      {thread.is_pinned && (
        <Pin className="size-3 shrink-0 text-amber-500" />
      )}

      {/* Running indicator */}
      {isRunning && (
        <Loader2 className="size-3 shrink-0 animate-spin text-blue-500" />
      )}

      {/* Title + timestamp */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{displayTitle}</span>
        <span className="truncate text-xs text-muted-foreground">
          {relativeTime}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread list (shared between desktop and mobile)
// ---------------------------------------------------------------------------

function ThreadList({
  threads,
  onThreadClick,
  onRename,
  onTogglePin,
  onArchive,
}: {
  threads: ThreadWithMeta[];
  onThreadClick?: (threadId: string) => void;
  onRename: (threadId: string) => void;
  onTogglePin: (threadId: string, isPinned: boolean) => void;
  onArchive: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="flex h-full w-full flex-col items-start gap-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.length === 0 ? (
        <div className="w-full py-8 text-center text-sm text-muted-foreground">
          No threads found
        </div>
      ) : (
        threads.map((t) => (
          <ThreadEntry
            key={t.thread_id}
            thread={t}
            isActive={t.thread_id === threadId}
            onClick={() => {
              onThreadClick?.(t.thread_id);
              if (t.thread_id !== threadId) {
                // Immediately update URL — nuqs throttle queue can lose
                // updates when external history.replaceState calls trigger
                // queue resets before the scheduled flush fires.
                const url = new URL(window.location.href);
                url.searchParams.set("threadId", t.thread_id);
                window.history.replaceState(null, "", url.toString());
                // Sync nuqs React state (emitter notifies all hooks)
                setThreadId(t.thread_id);
              }
            }}
            onRename={onRename}
            onTogglePin={onTogglePin}
            onArchive={onArchive}
          />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start gap-2 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={`skeleton-${i}`} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ThreadHistory sidebar
// ---------------------------------------------------------------------------

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [, setThreadId] = useQueryState("threadId");

  const {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    updateThread,
    archiveThread: archiveThreadApi,
  } = useThreads();

  const { query, setQuery, showArchived, setShowArchived, filtered } =
    useThreadSearch(threads);

  // Fetch threads on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh thread list helper
  const refreshThreads = useCallback(async () => {
    const updated = await getThreads(showArchived);
    setThreads(updated);
  }, [getThreads, setThreads, showArchived]);

  // Handlers
  const handleNewThread = useCallback(() => {
    // Immediately clear threadId from URL — same nuqs race condition
    // workaround as thread switching (see ThreadList onClick).
    const url = new URL(window.location.href);
    url.searchParams.delete("threadId");
    window.history.replaceState(null, "", url.toString());
    setThreadId(null);
  }, [setThreadId]);

  const handleRename = useCallback(
    async (threadId: string) => {
      const newTitle = window.prompt("Enter new thread title:");
      if (newTitle === null || newTitle.trim() === "") return;
      await updateThread(threadId, { title: newTitle.trim() });
      await refreshThreads();
    },
    [updateThread, refreshThreads],
  );

  const handleTogglePin = useCallback(
    async (threadId: string, isPinned: boolean) => {
      await updateThread(threadId, { is_pinned: !isPinned });
      await refreshThreads();
    },
    [updateThread, refreshThreads],
  );

  const handleArchive = useCallback(
    async (threadId: string) => {
      await archiveThreadApi(threadId);
      toast.success("Thread archived");
      await refreshThreads();
    },
    [archiveThreadApi, refreshThreads],
  );

  // Shared sidebar content
  const sidebarContent = (
    <>
      {/* Header with toggle and new-thread button */}
      <div className="flex w-full items-center justify-between px-3 pt-2">
        <Button
          className="hover:bg-gray-100"
          variant="ghost"
          size="icon"
          onClick={() => setChatHistoryOpen((p) => !p)}
        >
          {chatHistoryOpen ? (
            <PanelRightOpen className="size-5" />
          ) : (
            <PanelRightClose className="size-5" />
          )}
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Threads</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewThread}
          title="New Thread"
        >
          <Plus className="size-5" />
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative px-3 pt-2">
        <Search className="absolute left-5 top-4.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search threads..."
          className="pl-8 text-sm"
        />
      </div>

      {/* Show archived toggle */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <Switch
          id="show-archived"
          checked={showArchived}
          onCheckedChange={(checked) => {
            setShowArchived(checked);
            // Re-fetch if toggling on (need archived threads from backend)
            if (checked) {
              getThreads(true).then(setThreads).catch(console.error);
            }
          }}
        />
        <label
          htmlFor="show-archived"
          className="cursor-pointer text-xs text-muted-foreground"
        >
          Show archived
        </label>
      </div>

      {/* Thread list */}
      <div className="mt-2 flex-1 overflow-hidden">
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList
            threads={filtered}
            onRename={handleRename}
            onTogglePin={handleTogglePin}
            onArchive={handleArchive}
          />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start border-r-[1px] border-slate-300 lg:flex">
        {sidebarContent}
      </div>

      {/* Mobile sidebar (Sheet) */}
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent side="left" className="flex flex-col lg:hidden">
            <SheetHeader>
              <SheetTitle>Threads</SheetTitle>
            </SheetHeader>
            {/* Re-use same content with thread click closing sheet */}
            <div className="relative px-3 pt-2">
              <Search className="absolute left-5 top-4.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search threads..."
                className="pl-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 px-4 pt-2">
              <Switch
                id="show-archived-mobile"
                checked={showArchived}
                onCheckedChange={(checked) => {
                  setShowArchived(checked);
                  if (checked) {
                    getThreads(true).then(setThreads).catch(console.error);
                  }
                }}
              />
              <label
                htmlFor="show-archived-mobile"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Show archived
              </label>
            </div>
            <div className="mt-2 flex-1 overflow-hidden">
              {threadsLoading ? (
                <ThreadHistoryLoading />
              ) : (
                <ThreadList
                  threads={filtered}
                  onThreadClick={() => setChatHistoryOpen(false)}
                  onRename={handleRename}
                  onTogglePin={handleTogglePin}
                  onArchive={handleArchive}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
