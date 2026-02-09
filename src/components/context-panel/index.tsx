"use client";

/**
 * Context Panel - Thread-level agent context inspector.
 *
 * Side panel (Sheet) that shows what the agent "sees":
 * - Resolved entities with candidate scores
 * - Focus entities and entity history
 * - Context summary
 * - Token budget usage
 * - Current intent and active flow
 *
 * Collapsed by default, toggled via button.
 * Lazy-loads data from GET /threads/{id}/context when opened.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bug, RefreshCw, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EntityCandidates } from "./entity-candidates";
import { ContextBudget } from "./context-budget";
import { GraphTiming } from "./graph-timing";

const CASES_API =
  process.env.NEXT_PUBLIC_CASES_API_URL || "http://localhost:8000";

/** Shape returned by GET /threads/{id}/context */
interface ThreadContextData {
  resolved_entities: Record<string, unknown>;
  focus_entities: Array<Record<string, unknown>>;
  selected_entity: Record<string, unknown> | null;
  entity_candidates: Array<{
    node_id: string;
    canonical_key: string;
    name: string;
    entity_type: string;
    score: number;
    selected: boolean;
  }>;
  context_summary: string | null;
  token_budget_used: number;
  intent: string | null;
  intent_confidence: number | null;
  active_flow: string | null;
  evidence_count: number;
  case_id: string | null;
  confidence: Record<string, unknown> | null;
}

interface ContextPanelProps {
  threadId: string | null;
}

export function ContextPanel({ threadId }: ContextPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextData, setContextData] = useState<ThreadContextData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!threadId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${CASES_API}/threads/${threadId}/context`);
      if (!res.ok) {
        throw new Error(`Failed to fetch context: ${res.status}`);
      }
      const data: ThreadContextData = await res.json();
      setContextData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  // Lazy-load: fetch context only when panel is opened
  useEffect(() => {
    if (isOpen && threadId) {
      fetchContext();
    }
  }, [isOpen, threadId, fetchContext]);

  // Clear data when thread changes
  useEffect(() => {
    setContextData(null);
    setError(null);
  }, [threadId]);

  return (
    <>
      {/* Fixed toggle button -- always accessible at bottom-right */}
      <div className="fixed right-4 bottom-4 z-40">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full border-gray-300 bg-white shadow-md hover:bg-gray-50"
                onClick={() => setIsOpen(true)}
                data-testid="context-panel-toggle"
              >
                <Bug className="size-4" />
                <span className="sr-only">Agent Context</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Agent Context</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Agent Context</SheetTitle>
            <SheetDescription>
              Thread-level agent state inspector
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4 pt-0">
            {!threadId && (
              <p className="text-muted-foreground text-sm">
                No thread selected. Start a conversation to see agent context.
              </p>
            )}

            {threadId && loading && <LoadingSkeleton />}

            {threadId && error && (
              <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchContext}
                  className="w-fit"
                >
                  <RefreshCw className="mr-1 size-3" />
                  Retry
                </Button>
              </div>
            )}

            {threadId && !loading && !error && !contextData && (
              <p className="text-muted-foreground text-sm">
                No context available yet.
              </p>
            )}

            {threadId && !loading && !error && contextData && (
              <>
                {/* Intent + Flow badges */}
                <IntentFlowSection
                  intent={contextData.intent}
                  intentConfidence={contextData.intent_confidence}
                  activeFlow={contextData.active_flow}
                  evidenceCount={contextData.evidence_count}
                  caseId={contextData.case_id}
                />

                {/* Entity Resolution */}
                <EntityCandidates
                  entityCandidates={contextData.entity_candidates}
                  focusEntities={contextData.focus_entities}
                  resolvedEntities={contextData.resolved_entities}
                />

                {/* Context Summary */}
                {contextData.context_summary && (
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">
                      Context Summary
                    </h3>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {contextData.context_summary}
                    </p>
                  </section>
                )}

                {/* Confidence */}
                {contextData.confidence && (
                  <ConfidenceSection confidence={contextData.confidence} />
                )}

                {/* Token Budget */}
                <ContextBudget
                  tokenBudgetUsed={contextData.token_budget_used}
                />

                {/* Graph Timing (placeholder until timing data is available) */}
                <GraphTiming nodes={[]} />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ----- Sub-sections ----- */

function IntentFlowSection({
  intent,
  intentConfidence,
  activeFlow,
  evidenceCount,
  caseId,
}: {
  intent: string | null;
  intentConfidence: number | null;
  activeFlow: string | null;
  evidenceCount: number;
  caseId: string | null;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Intent &amp; Flow</h3>
      <div className="flex flex-wrap gap-2">
        {intent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {intent}
            {intentConfidence != null && (
              <span className="text-blue-500">
                ({(intentConfidence * 100).toFixed(0)}%)
              </span>
            )}
          </span>
        )}
        {activeFlow && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            {activeFlow}
          </span>
        )}
        {caseId && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            Case: {caseId.slice(0, 8)}...
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          {evidenceCount} evidence
        </span>
      </div>
    </section>
  );
}

function ConfidenceSection({
  confidence,
}: {
  confidence: Record<string, unknown>;
}) {
  const level = typeof confidence.level === "string" ? confidence.level : null;
  const reason =
    typeof confidence.reason === "string" ? confidence.reason : null;

  if (!level) return null;

  const colorMap: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };
  const colorClass = colorMap[level] || "bg-gray-100 text-gray-800";

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Confidence</h3>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {level}
      </span>
      {reason && (
        <p className="text-muted-foreground mt-1 text-xs">{reason}</p>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">
          Loading context...
        </span>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
