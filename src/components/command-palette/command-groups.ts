/**
 * Command palette command group definitions.
 *
 * Each command belongs to a group and has an id, label, optional shortcut,
 * and a callback type that the CommandPalette component maps to real handlers.
 */

import { SHORTCUTS, type ShortcutDefinition } from "@/lib/shortcuts";

export type CommandCallbackType =
  | "newThread"
  | "toggleEvidence"
  | "toggleCasePanel"
  | "focusInput"
  | "approveInterrupt"
  | "slashCommand";

export interface CommandItem {
  id: string;
  label: string;
  /** lucide-react icon name (rendered by CommandPalette) */
  icon: string;
  shortcut?: ShortcutDefinition;
  group: string;
  callbackType: CommandCallbackType;
  /** For slash commands, the command string (e.g. "/investigate") */
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
    id: "toggle-evidence",
    label: "Toggle Evidence",
    icon: "FileSearch",
    shortcut: SHORTCUTS.TOGGLE_EVIDENCE,
    group: "Actions",
    callbackType: "toggleEvidence",
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
  {
    id: "approve-interrupt",
    label: "Approve Interrupt",
    icon: "CheckCircle",
    shortcut: SHORTCUTS.APPROVE_INTERRUPT,
    group: "Actions",
    callbackType: "approveInterrupt",
  },
];

export const SLASH_COMMANDS: CommandItem[] = [
  {
    id: "slash-investigate",
    label: "/investigate",
    icon: "Search",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/investigate",
  },
  {
    id: "slash-build",
    label: "/build",
    icon: "Hammer",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/build",
  },
  {
    id: "slash-catalog",
    label: "/catalog",
    icon: "BookOpen",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/catalog",
  },
  {
    id: "slash-ops",
    label: "/ops",
    icon: "Terminal",
    group: "Slash Commands",
    callbackType: "slashCommand",
    slashCommand: "/ops",
  },
];

export const ALL_COMMANDS: CommandItem[] = [
  ...ACTION_COMMANDS,
  ...SLASH_COMMANDS,
];
