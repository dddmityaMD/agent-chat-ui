/**
 * Central keyboard shortcut definitions for SAIS DataBI.
 *
 * All global shortcuts are defined here. Components import from this file
 * to ensure consistency between shortcut registration and display hints.
 */

export interface ShortcutDefinition {
  /** react-hotkeys-hook key combo string */
  key: string;
  /** Human-readable label for command palette */
  label: string;
  /** Platform-specific display strings */
  display: { mac: string; default: string };
}

export const SHORTCUTS = {
  COMMAND_PALETTE: {
    key: "mod+k",
    label: "Command Palette",
    display: { mac: "\u2318K", default: "Ctrl+K" },
  },
  FOCUS_INPUT: {
    key: "mod+/",
    label: "Focus Input",
    display: { mac: "\u2318/", default: "Ctrl+/" },
  },
  TOGGLE_CASE_PANEL: {
    key: "mod+e",
    label: "Toggle Case Panel",
    display: { mac: "\u2318E", default: "Ctrl+E" },
  },
  TOGGLE_EVIDENCE: {
    key: "mod+shift+e",
    label: "Toggle Evidence",
    display: { mac: "\u2318\u21e7E", default: "Ctrl+Shift+E" },
  },
  CLOSE: {
    key: "escape",
    label: "Close",
    display: { mac: "Esc", default: "Esc" },
  },
  APPROVE_INTERRUPT: {
    key: "mod+enter",
    label: "Approve",
    display: { mac: "\u2318\u21a9", default: "Ctrl+Enter" },
  },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutName = keyof typeof SHORTCUTS;

/**
 * Returns the platform-specific display string for a shortcut.
 * Uses navigator.platform to detect Mac (SSR-safe: defaults to non-Mac).
 */
export function getShortcutDisplay(
  shortcut: ShortcutDefinition,
): string {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? shortcut.display.mac : shortcut.display.default;
}
