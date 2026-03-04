/**
 * NodeContextMenu.tsx — Right-click context menu for lineage graph nodes.
 */

import React, { useRef } from "react";

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

export function NodeContextMenu({
  menu,
  onAnalyzeImpact,
  onClose,
}: {
  menu: ContextMenuState;
  onAnalyzeImpact: (nodeId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-[60] min-w-[180px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: menu.x, top: menu.y }}
      data-testid="node-context-menu"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {menu.nodeLabel}
      </div>
      <hr className="border-zinc-200 dark:border-zinc-700" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        onClick={() => {
          onAnalyzeImpact(menu.nodeId);
          onClose();
        }}
        data-testid="context-menu-analyze-impact"
      >
        <span className="text-red-500">&#9889;</span>
        Analyze Impact
      </button>
    </div>
  );
}
