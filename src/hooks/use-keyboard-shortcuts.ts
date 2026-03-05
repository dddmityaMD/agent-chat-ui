/**
 * Global keyboard shortcut registration hook.
 *
 * Uses react-hotkeys-hook to register all SAIS keyboard shortcuts in one place.
 * Individual components should NOT register their own global shortcuts -- instead
 * pass callbacks through this hook.
 */

import { useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

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
 *
 * Ctrl+/ uses a raw keydown listener because react-hotkeys-hook doesn't
 * reliably capture the "/" key with modifiers on all browsers/platforms.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  // Ctrl+/ (or Cmd+/) — raw listener for reliability
  const focusHandler = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => handlers.onFocusInput(), 0);
      }
    },
    [handlers],
  );

  useEffect(() => {
    document.addEventListener("keydown", focusHandler, true);
    return () => document.removeEventListener("keydown", focusHandler, true);
  }, [focusHandler]);

  useHotkeys(
    "mod+e",
    (e) => {
      e.preventDefault();
      handlers.onToggleCasePanel();
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    "mod+shift+e",
    (e) => {
      e.preventDefault();
      handlers.onToggleEvidence();
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      handlers.onApproveInterrupt();
    },
    { enableOnFormTags: true },
  );
}
