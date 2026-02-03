/**
 * LayerToggle - Toggle button for architecture layer zone backgrounds.
 *
 * Stub implementation -- Task 2 fills in the full UI.
 */
"use client";

import React from "react";
import { Layers } from "lucide-react";

interface LayerToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function LayerToggle({ enabled, onToggle }: LayerToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      title={enabled ? "Hide architecture layers" : "Show architecture layers"}
      className={`flex items-center justify-center rounded-md border p-1.5 shadow-sm transition-colors ${
        enabled
          ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          : "border-zinc-200 bg-white text-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-300"
      }`}
    >
      <Layers className="h-3.5 w-3.5" />
    </button>
  );
}
