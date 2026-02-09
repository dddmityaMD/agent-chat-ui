"use client";

/**
 * ContextPanelBridge - Thin bridge between page layout and ContextPanel.
 *
 * Reads threadId from query state and renders the ContextPanel.
 * The toggle button is positioned fixed at the bottom-right corner
 * so it's always accessible regardless of where this component is
 * placed in the tree.
 */

import { useQueryState } from "nuqs";
import { ContextPanel } from "./index";

export function ContextPanelBridge() {
  const [threadId] = useQueryState("threadId");
  return <ContextPanel threadId={threadId} />;
}
