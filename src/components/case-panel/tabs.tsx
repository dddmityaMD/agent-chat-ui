"use client";

import React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  LayoutDashboard,
  FileSearch,
  DollarSign,
  Hammer,
  Workflow,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

export type TabValue = "summary" | "flow" | "build" | "investigation" | "cost";

export interface TabConfig {
  value: TabValue;
  label: string;
  icon: LucideIcon;
}

export const TAB_CONFIG: TabConfig[] = [
  { value: "summary", label: "Summary", icon: LayoutDashboard },
  { value: "flow", label: "Flow", icon: Workflow },
  { value: "build", label: "Build", icon: Wrench },
  { value: "investigation", label: "Investigation", icon: FileSearch },
  { value: "cost", label: "Cost", icon: DollarSign },
];

// ---------------------------------------------------------------------------
// TabTrigger -- styled trigger with icon + label + optional badge count
// ---------------------------------------------------------------------------

interface TabTriggerProps {
  config: TabConfig;
  badgeCount?: number;
}

export function TabTrigger({ config, badgeCount }: TabTriggerProps) {
  const Icon = config.icon;
  return (
    <Tabs.Trigger
      value={config.value}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm",
        "text-muted-foreground",
        "border-b-2 border-transparent",
        "data-[state=active]:border-blue-600 data-[state=active]:font-semibold data-[state=active]:text-blue-600",
        "hover:text-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      data-testid={`${config.value}-tab`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      {badgeCount != null && badgeCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 text-xs text-primary">
          {badgeCount}
        </span>
      )}
    </Tabs.Trigger>
  );
}
