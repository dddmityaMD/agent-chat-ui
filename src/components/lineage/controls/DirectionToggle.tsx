/**
 * DirectionToggle - Three-state toggle for upstream/downstream/both filtering.
 *
 * Stub implementation -- Task 2 fills in the full UI.
 */
"use client";

import React from "react";
import { ArrowLeft, ArrowRight, ArrowLeftRight } from "lucide-react";

export type Direction = "upstream" | "downstream" | "both";

interface DirectionToggleProps {
  direction: Direction;
  onChange: (direction: Direction) => void;
}

const BUTTONS: { value: Direction; Icon: typeof ArrowLeft; label: string }[] = [
  { value: "upstream", Icon: ArrowLeft, label: "Upstream" },
  { value: "both", Icon: ArrowLeftRight, label: "Both" },
  { value: "downstream", Icon: ArrowRight, label: "Downstream" },
];

export function DirectionToggle({ direction, onChange }: DirectionToggleProps) {
  return (
    <div className="flex rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {BUTTONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          title={label}
          className={`flex items-center justify-center p-1.5 text-xs transition-colors first:rounded-l-md last:rounded-r-md ${
            direction === value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
