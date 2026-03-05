/**
 * Mock for react-hotkeys-hook used in Jest tests.
 *
 * Records registered hotkeys and their callbacks so tests can verify
 * shortcut registration and trigger callbacks manually.
 */

type HotkeyCallback = (e: KeyboardEvent) => void;
type Options = Record<string, unknown>;

const registeredHotkeys: Map<string, HotkeyCallback> = new Map();

export function useHotkeys(
  keys: string,
  callback: HotkeyCallback,
  _options?: Options,
  _deps?: unknown[],
): void {
  // Store the callback so tests can trigger it
  registeredHotkeys.set(keys, callback);
}

/** Test helper: get all registered hotkey keys */
export function __getRegisteredHotkeys(): Map<string, HotkeyCallback> {
  return registeredHotkeys;
}

/** Test helper: clear registered hotkeys between tests */
export function __clearRegisteredHotkeys(): void {
  registeredHotkeys.clear();
}

/** Test helper: trigger a registered hotkey callback */
export function __triggerHotkey(keys: string): void {
  const callback = registeredHotkeys.get(keys);
  if (callback) {
    callback(new KeyboardEvent("keydown", { key: keys }) as KeyboardEvent);
  }
}
