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

/** Flow display configuration */
interface FlowConfig {
  label: string;
  /** Tailwind classes for the pill background and text */
  classes: string;
}

const FLOW_CONFIG: Record<string, FlowConfig> = {
  catalog: {
    label: "Catalog",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  investigation: {
    label: "Investigation",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  build: {
    label: "Build",
    classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  remediation: {
    label: "Remediation",
    classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  ops: {
    label: "Ops",
    classes: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
};

interface FlowIndicatorProps {
  /** Current active flow name from sais_ui (e.g., "catalog", "investigation") */
  activeFlow: string | null;
  /** Optional flow transition metadata */
  flowTransition?: {
    from: string;
    to: string;
    context_carried: string[];
  } | null;
}

export function FlowIndicator({ activeFlow, flowTransition }: FlowIndicatorProps) {
  const config = useMemo(() => {
    if (!activeFlow) return null;
    return FLOW_CONFIG[activeFlow] ?? {
      label: activeFlow.charAt(0).toUpperCase() + activeFlow.slice(1),
      classes: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
  }, [activeFlow]);

  if (!config) return null;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        transition-all duration-300 ease-in-out
        ${config.classes}
      `}
      title={
        flowTransition
          ? `Transitioned from ${flowTransition.from} to ${flowTransition.to}`
          : `Current mode: ${config.label}`
      }
    >
      <span
        className={`
          inline-block w-1.5 h-1.5 rounded-full
          ${activeFlow === "investigation" ? "bg-amber-500" : ""}
          ${activeFlow === "catalog" ? "bg-blue-500" : ""}
          ${activeFlow === "build" || activeFlow === "remediation" ? "bg-green-500" : ""}
          ${activeFlow === "ops" ? "bg-purple-500" : ""}
        `}
      />
      {config.label}
    </span>
  );
}
