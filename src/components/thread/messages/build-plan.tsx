"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { BuildPlan, BuildStep } from "@/lib/types";
import {
  FileText,
  Database,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface BuildPlanDisplayProps {
  plan: BuildPlan;
  className?: string;
}

// Get icon for step action type
function getStepIcon(action: BuildStep["action"]) {
  switch (action) {
    case "create_file":
    case "modify_file":
      return FileText;
    case "run_dbt":
    case "run_test":
      return Database;
    case "create_card":
      return BarChart3;
    case "verify":
      return CheckCircle2;
  }
}

// Risk level badge styling
const riskLevelConfig = {
  low: {
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    label: "Low Risk",
  },
  medium: {
    className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
    label: "Medium Risk",
  },
  high: {
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    label: "High Risk",
  },
};

// Step display component
function StepDisplay({ step }: { step: BuildStep }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getStepIcon(step.action);
  const hasPreview = step.content_preview && step.content_preview.length > 0;

  return (
    <div
      className="border-l-2 border-gray-200 pl-4 py-2 dark:border-gray-700"
      data-testid={`build-step-${step.step_number}`}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {step.step_number}
        </span>
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {step.description}
          </p>
          <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded mt-1 inline-block font-mono">
            {step.target}
          </code>
          {step.depends_on && step.depends_on.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Depends on: step{step.depends_on.length > 1 ? "s" : ""}{" "}
              {step.depends_on.join(", ")}
            </p>
          )}
          {hasPreview && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {isExpanded ? "Hide" : "Show"} preview
              </button>
              {isExpanded && (
                <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto border border-gray-200 dark:border-gray-700">
                  <code className="text-gray-700 dark:text-gray-300">
                    {step.content_preview}
                  </code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main build plan display component
export function BuildPlanDisplay({ plan, className }: BuildPlanDisplayProps) {
  const riskConfig = riskLevelConfig[plan.risk_level];

  return (
    <div
      className={cn(
        "rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950",
        className
      )}
      data-testid="build-plan"
    >
      {/* Plan header */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100">
          {plan.title}
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
          {plan.context_summary}
        </p>
      </div>

      {/* Risk and impact badges */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
            riskConfig.className
          )}
          data-testid="build-risk-badge"
        >
          {riskConfig.label}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          Impact: {plan.estimated_impact}
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-1 mb-4">
        {plan.steps.map((step) => (
          <StepDisplay key={step.step_number} step={step} />
        ))}
      </div>

      {/* Approval prompt */}
      <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Reply <strong>approve</strong> to proceed, or describe what to change.
        </p>
      </div>
    </div>
  );
}
