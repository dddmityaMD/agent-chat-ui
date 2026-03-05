/**
 * Command palette command group definitions.
 *
 * Each command belongs to a group and has an id, label, optional shortcut,
 * and a callback type that the CommandPalette component maps to real handlers.
 */

import { SHORTCUTS, type ShortcutDefinition } from "@/lib/shortcuts";

export type CommandCallbackType =
  | "newThread"
  | "toggleCasePanel"
  | "focusInput"
  | "slashCommand";

export interface CommandItem {
  id: string;
  label: string;
  /** lucide-react icon name (rendered by CommandPalette) */
  icon: string;
  shortcut?: ShortcutDefinition;
  group: string;
  callbackType: CommandCallbackType;
  /** For slash commands, the command string (e.g. "/list") */
  slashCommand?: string;
}

export const ACTION_COMMANDS: CommandItem[] = [
  {
    id: "new-thread",
    label: "New Thread",
    icon: "SquarePen",
    group: "Actions",
    callbackType: "newThread",
  },
  {
    id: "toggle-case-panel",
    label: "Toggle Case Panel",
    icon: "PanelRight",
    shortcut: SHORTCUTS.TOGGLE_CASE_PANEL,
    group: "Actions",
    callbackType: "toggleCasePanel",
  },
  {
    id: "focus-input",
    label: "Focus Input",
    icon: "MessageSquare",
    shortcut: SHORTCUTS.FOCUS_INPUT,
    group: "Actions",
    callbackType: "focusInput",
  },
];

export const SLASH_COMMANDS: CommandItem[] = [
  {
    id: "slash-list",
    label: "/list",
    icon: "Search",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/list",
  },
  {
    id: "slash-help",
    label: "/help",
    icon: "HelpCircle",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/help",
  },
  {
    id: "slash-approve",
    label: "/approve",
    icon: "CheckCircle",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/approve",
  },
];

export const ALL_COMMANDS: CommandItem[] = [
  ...ACTION_COMMANDS,
  ...SLASH_COMMANDS,
];
