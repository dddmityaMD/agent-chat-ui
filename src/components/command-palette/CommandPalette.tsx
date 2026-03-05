"use client";

/**
 * CommandPalette -- Mod+K command palette using cmdk.
 *
 * Provides fuzzy search across actions, slash commands, and recent threads.
 * Uses Command.Dialog from cmdk which wraps Radix Dialog internally.
 */

import { Command } from "cmdk";
import { useHotkeys } from "react-hotkeys-hook";
import { getShortcutDisplay, SHORTCUTS } from "@/lib/shortcuts";
import {
  ACTION_COMMANDS,
  SLASH_COMMANDS,
  type CommandItem,
} from "./command-groups";
import {
  Search,
  SquarePen,
  FileSearch,
  PanelRight,
  MessageSquare,
  CheckCircle,
  Hammer,
  BookOpen,
  Terminal,
  MessageCircle,
} from "lucide-react";

/** Map icon name strings to lucide-react components */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  SquarePen,
  FileSearch,
  PanelRight,
  MessageSquare,
  CheckCircle,
  Search,
  Hammer,
  BookOpen,
  Terminal,
};

export interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  threads: Array<{ id: string; title: string }>;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onToggleEvidence: () => void;
  onToggleCasePanel: () => void;
  onFocusInput: () => void;
  onSlashCommand: (command: string) => void;
}

export function CommandPalette({
  open,
  setOpen,
  threads,
  onNewThread,
  onSelectThread,
  onToggleEvidence,
  onToggleCasePanel,
  onFocusInput,
  onSlashCommand,
}: CommandPaletteProps) {
  // Mod+K toggles the palette
  useHotkeys(
    SHORTCUTS.COMMAND_PALETTE.key,
    (e) => {
      e.preventDefault();
      setOpen(!open);
    },
    { enableOnFormTags: true },
  );

  const handleSelect = (item: CommandItem) => {
    switch (item.callbackType) {
      case "newThread":
        onNewThread();
        break;
      case "toggleEvidence":
        onToggleEvidence();
        break;
      case "toggleCasePanel":
        onToggleCasePanel();
        break;
      case "focusInput":
        onFocusInput();
        break;
      case "slashCommand":
        if (item.slashCommand) onSlashCommand(item.slashCommand);
        break;
      case "approveInterrupt":
        // Approve is handled by the shortcut directly
        break;
    }
    setOpen(false);
  };

  if (!open) return null;

  const recentThreads = threads.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-[20vh] w-full max-w-xl">
        <Command
          className="rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center border-b border-gray-200 px-3 dark:border-gray-700">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <Command.Input
              placeholder="Search actions, commands, threads..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto px-1 py-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            {/* Actions group */}
            <Command.Group
              heading="Actions"
              className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {ACTION_COMMANDS.map((item) => (
                <CommandItemRow
                  key={item.id}
                  item={item}
                  onSelect={() => handleSelect(item)}
                />
              ))}
            </Command.Group>

            {/* Slash Commands group */}
            <Command.Group
              heading="Slash Commands"
              className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {SLASH_COMMANDS.map((item) => (
                <CommandItemRow
                  key={item.id}
                  item={item}
                  onSelect={() => handleSelect(item)}
                />
              ))}
            </Command.Group>

            {/* Recent Threads group */}
            {recentThreads.length > 0 && (
              <Command.Group
                heading="Recent Threads"
                className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {recentThreads.map((thread) => (
                  <Command.Item
                    key={thread.id}
                    value={thread.title}
                    onSelect={() => {
                      onSelectThread(thread.id);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-200 dark:aria-selected:bg-gray-800"
                  >
                    <MessageCircle className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate">{thread.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

/** Single command item row with icon and optional shortcut hint */
function CommandItemRow({
  item,
  onSelect,
}: {
  item: CommandItem;
  onSelect: () => void;
}) {
  const Icon = ICON_MAP[item.icon];

  return (
    <Command.Item
      value={item.label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-200 dark:aria-selected:bg-gray-800"
    >
      {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-xs text-gray-400">
          {getShortcutDisplay(item.shortcut)}
        </span>
      )}
    </Command.Item>
  );
}
