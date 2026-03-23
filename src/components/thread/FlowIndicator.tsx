"use client";

/**
 * FlowIndicator - Visual indicator of the current active flow.
 *
 * Shows a small colored pill/badge in the thread header area indicating
 * which mode the agent is currently operating in (Catalog, Investigation,
 * Build, Ops). Updates with a fade transition when the flow changes.
 *
 * Phase 23: INTEL-06
 */

import { useMemo } from "react";

/** Methodology display configuration */
interface MethodologyConfig {
  label: string;
  /** Tailwind classes for the pill background and text */
  classes: string;
}

const METHODOLOGY_CONFIG: Record<string, MethodologyConfig> = {
  catalog: {
    label: "Catalog",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  investigation: {
    label: "Investigation",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  build: {
    label: "Build",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  remediation: {
    label: "Remediation",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  ops: {
    label: "Ops",
    classes:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
};

interface FlowIndicatorProps {
  /** Current active methodology name from sais_ui (e.g., "catalog", "investigation") */
  activeMethodology: string | null;
  /** Optional flow transition metadata */
  flowTransition?: {
    from: string;
    to: string;
    context_carried: string[];
  } | null;
}

export function FlowIndicator({
  activeMethodology,
  flowTransition,
}: FlowIndicatorProps) {
  const config = useMemo(() => {
    if (!activeMethodology) return null;
    return (
      METHODOLOGY_CONFIG[activeMethodology] ?? {
        label:
          activeMethodology.charAt(0).toUpperCase() +
          activeMethodology.slice(1),
        classes:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      }
    );
  }, [activeMethodology]);

  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all duration-300 ease-in-out ${config.classes} `}
      title={
        flowTransition
          ? `Transitioned from ${flowTransition.from} to ${flowTransition.to}`
          : `Current mode: ${config.label}`
      }
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${activeMethodology === "investigation" ? "bg-amber-500" : ""} ${activeMethodology === "catalog" ? "bg-blue-500" : ""} ${activeMethodology === "build" || activeMethodology === "remediation" ? "bg-green-500" : ""} ${activeMethodology === "ops" ? "bg-purple-500" : ""} `}
      />
      {config.label}
    </span>
  );
}
