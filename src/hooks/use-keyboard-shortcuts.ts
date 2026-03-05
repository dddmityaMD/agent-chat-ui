/**
 * Global keyboard shortcut registration hook.
 *
 * Uses react-hotkeys-hook to register all SAIS keyboard shortcuts in one place.
 * Individual components should NOT register their own global shortcuts -- instead
 * pass callbacks through this hook.
 */

import { useHotkeys } from "react-hotkeys-hook";
import { SHORTCUTS } from "@/lib/shortcuts";

export interface GlobalShortcutHandlers {
  onFocusInput: () => void;
  onToggleCasePanel: () => void;
  onToggleEvidence: () => void;
  onApproveInterrupt: () => void;
}

/**
 * Registers global keyboard shortcuts. Mount once at the app level.
 *
 * Note: Mod+K is handled by the CommandPalette component itself (cmdk manages it).
 * Escape is handled by cmdk dialog. This hook handles the remaining shortcuts.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  useHotkeys(
    SHORTCUTS.FOCUS_INPUT.key,
    (e) => {
      e.preventDefault();
      handlers.onFocusInput();
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    SHORTCUTS.TOGGLE_CASE_PANEL.key,
    (e) => {
      e.preventDefault();
      handlers.onToggleCasePanel();
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    SHORTCUTS.TOGGLE_EVIDENCE.key,
    (e) => {
      e.preventDefault();
      handlers.onToggleEvidence();
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    SHORTCUTS.APPROVE_INTERRUPT.key,
    (e) => {
      e.preventDefault();
      handlers.onApproveInterrupt();
    },
    { enableOnFormTags: true },
  );
}
