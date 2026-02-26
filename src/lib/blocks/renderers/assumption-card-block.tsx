"use client";

import { useState } from "react";
import type { BlockRendererProps } from "../types";
import type { AssumptionCardBlockData } from "../types";
import { Button } from "@/components/ui/button";
import { Check, Edit3, ShieldCheck } from "lucide-react";

interface AssumptionDecision {
  action: "confirmed" | "overridden";
  value?: string;
}

export function AssumptionCardBlock({
  block,
  isActive,
  onSubmit,
}: BlockRendererProps) {
  const data = block as AssumptionCardBlockData;

  // Local state: decisions per assumption_id
  const [decisions, setDecisions] = useState<
    Record<string, AssumptionDecision>
  >(() => {
    // Initialize all as confirmed by default
    const initial: Record<string, AssumptionDecision> = {};
    for (const a of data.assumptions) {
      initial[a.assumption_id] = { action: "confirmed" };
    }
    return initial;
  });

  // Track which items are in override mode (showing text input)
  const [overrideMode, setOverrideMode] = useState<Record<string, boolean>>(
    {},
  );
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>(
    {},
  );

  const isResolved = !!data.decided_at || !isActive;
  const resolvedDecisions = data.decision;

  const handleConfirm = (assumptionId: string) => {
    setOverrideMode((prev) => ({ ...prev, [assumptionId]: false }));
    setDecisions((prev) => ({
      ...prev,
      [assumptionId]: { action: "confirmed" },
    }));
  };

  const handleStartOverride = (assumptionId: string) => {
    setOverrideMode((prev) => ({ ...prev, [assumptionId]: true }));
  };

  const handleOverrideChange = (assumptionId: string, value: string) => {
    setOverrideValues((prev) => ({ ...prev, [assumptionId]: value }));
    setDecisions((prev) => ({
      ...prev,
      [assumptionId]: { action: "overridden", value },
    }));
  };

  const handleSubmit = () => {
    onSubmit?.({ approved: true, decisions });
  };

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Assumptions to Confirm
        </h3>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {data.assumptions.length} item{data.assumptions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable assumption list */}
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {data.assumptions.map((assumption) => {
          const resolved = resolvedDecisions?.[assumption.assumption_id];
          const currentDecision = decisions[assumption.assumption_id];
          const isOverriding = overrideMode[assumption.assumption_id];

          return (
            <div
              key={assumption.assumption_id}
              className="rounded-md border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/50"
            >
              {/* Category badge + confidence */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  {assumption.category}
                </span>
                {assumption.blocking && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    blocking
                  </span>
                )}
                <span
                  className={`ml-auto text-xs font-medium ${confidenceColor(assumption.confidence)}`}
                >
                  {Math.round(assumption.confidence * 100)}% confidence
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {assumption.description}
              </p>

              {/* Default value */}
              {assumption.default_value && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default: {assumption.default_value}
                </p>
              )}

              {/* Resolved state */}
              {isResolved && resolved && (
                <div className="mt-2 flex items-center gap-2">
                  {resolved.action === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                      <Edit3 className="h-3 w-3" />
                      Overridden: {resolved.value}
                    </span>
                  )}
                </div>
              )}

              {/* Interactive state */}
              {!isResolved && isActive && (
                <div className="mt-2 flex items-center gap-2">
                  {!isOverriding ? (
                    <>
                      <Button
                        size="sm"
                        variant={
                          currentDecision?.action === "confirmed"
                            ? "default"
                            : "outline"
                        }
                        className={
                          currentDecision?.action === "confirmed"
                            ? "gap-1 bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                            : "gap-1 text-xs h-7"
                        }
                        onClick={() => handleConfirm(assumption.assumption_id)}
                      >
                        <Check className="h-3 w-3" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-7"
                        onClick={() =>
                          handleStartOverride(assumption.assumption_id)
                        }
                      >
                        <Edit3 className="h-3 w-3" />
                        Override
                      </Button>
                    </>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <input
                        type="text"
                        value={overrideValues[assumption.assumption_id] ?? ""}
                        onChange={(e) =>
                          handleOverrideChange(
                            assumption.assumption_id,
                            e.target.value,
                          )
                        }
                        placeholder="Enter override value..."
                        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() =>
                          handleConfirm(assumption.assumption_id)
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!isResolved && isActive && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleSubmit}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            <Check className="h-3.5 w-3.5" />
            Submit Decisions
          </Button>
        </div>
      )}
    </div>
  );
}
