/**
 * FlowBadge - Active flow indicator badge for chat messages.
 *
 * Shows a subtle pill badge with an icon and label indicating which
 * flow is currently active (Catalog, Investigation, Remediation, or Operations).
 * Renders nothing if flowType is null/empty.
 */

import { BookOpen, Search, Wrench, Settings, type LucideIcon } from "lucide-react";

interface FlowConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

const FLOW_CONFIGS: Record<string, FlowConfig> = {
  catalog: {
    label: "Catalog",
    icon: BookOpen,
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  investigation: {
    label: "Investigation",
    icon: Search,
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  remediation: {
    label: "Remediation",
    icon: Wrench,
    className:
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  ops: {
    label: "Operations",
    icon: Settings,
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

export interface FlowBadgeProps {
  flowType: string | null;
}

export function FlowBadge({ flowType }: FlowBadgeProps) {
  if (!flowType) return null;

  const config = FLOW_CONFIGS[flowType];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
      data-testid="flow-badge"
      aria-label={`Active flow: ${config.label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}
