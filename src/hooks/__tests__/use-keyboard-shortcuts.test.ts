import { renderHook } from "@testing-library/react";
import { getShortcutDisplay, SHORTCUTS } from "@/lib/shortcuts";

// We test the shortcuts definitions directly and mock useHotkeys for the hook
// The hook itself will be tested once implemented

describe("getShortcutDisplay", () => {
  it("returns default (non-Mac) labels when navigator.platform is not Mac", () => {
    // jsdom defaults to empty string for navigator.platform (not Mac)
    expect(getShortcutDisplay(SHORTCUTS.COMMAND_PALETTE)).toBe("Ctrl+K");
    expect(getShortcutDisplay(SHORTCUTS.FOCUS_INPUT)).toBe("Ctrl+/");
    expect(getShortcutDisplay(SHORTCUTS.TOGGLE_CASE_PANEL)).toBe("Ctrl+E");
    expect(getShortcutDisplay(SHORTCUTS.TOGGLE_EVIDENCE)).toBe("Ctrl+Shift+E");
    expect(getShortcutDisplay(SHORTCUTS.CLOSE)).toBe("Esc");
    expect(getShortcutDisplay(SHORTCUTS.APPROVE_INTERRUPT)).toBe("Ctrl+Enter");
  });

  it("returns Mac labels when navigator.platform contains MAC", () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
      configurable: true,
    });

    expect(getShortcutDisplay(SHORTCUTS.COMMAND_PALETTE)).toContain("K");
    expect(getShortcutDisplay(SHORTCUTS.TOGGLE_CASE_PANEL)).toContain("E");

    Object.defineProperty(navigator, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });
});

describe("SHORTCUTS constant", () => {
  it("defines all 6 required shortcuts", () => {
    expect(SHORTCUTS.COMMAND_PALETTE).toBeDefined();
    expect(SHORTCUTS.FOCUS_INPUT).toBeDefined();
    expect(SHORTCUTS.TOGGLE_CASE_PANEL).toBeDefined();
    expect(SHORTCUTS.TOGGLE_EVIDENCE).toBeDefined();
    expect(SHORTCUTS.CLOSE).toBeDefined();
    expect(SHORTCUTS.APPROVE_INTERRUPT).toBeDefined();
  });

  it("each shortcut has key, label, and display properties", () => {
    for (const shortcut of Object.values(SHORTCUTS)) {
      expect(shortcut.key).toBeTruthy();
      expect(shortcut.label).toBeTruthy();
      expect(shortcut.display.mac).toBeTruthy();
      expect(shortcut.display.default).toBeTruthy();
    }
  });
});

// useGlobalShortcuts hook tests -- will fail until implementation exists
describe("useGlobalShortcuts", () => {
  it("can be imported and called with handler callbacks", async () => {
    const { useGlobalShortcuts } =
      await import("@/hooks/use-keyboard-shortcuts");

    const handlers = {
      onFocusInput: jest.fn(),
      onToggleCasePanel: jest.fn(),
      onToggleEvidence: jest.fn(),
      onApproveInterrupt: jest.fn(),
    };

    // Should not throw when rendered
    renderHook(() => useGlobalShortcuts(handlers));
  });
});
