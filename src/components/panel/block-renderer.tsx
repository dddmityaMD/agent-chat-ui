"use client";

import type { PanelBlock, BlockState } from "@/lib/panel-blocks/types";
import { AgentStatusBlock } from "./blocks/l1/agent-status";
import { PlanApprovalBlock } from "./blocks/action/plan-approval";
import { DisambiguationBlock } from "./blocks/action/disambiguation";

interface BlockRendererProps {
  block: PanelBlock;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * Routes block type string to the correct component.
 *
 * This plan creates 3 components: agent-status, plan-approval, entity-disambiguation.
 * All other block types render a JSON fallback. Plan 03B and 08 will replace fallbacks.
 */
export function BlockRenderer({
  block,
  onAction,
  onCanvasOpen,
}: BlockRendererProps) {
  const state = block.state as BlockState;

  switch (block.type) {
    case "agent-status":
      return <AgentStatusBlock block={block} state={state} />;

    case "plan-approval":
      return (
        <PlanApprovalBlock block={block} state={state} onAction={onAction} />
      );

    case "entity-disambiguation":
      return (
        <DisambiguationBlock block={block} state={state} onAction={onAction} />
      );

    default:
      // JSON fallback for unbuilt block types (no broken imports)
      return (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {block.type}
            </span>
            <span className="text-xs text-muted-foreground/60">
              [{block.level}]
            </span>
          </div>
          <pre className="text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {JSON.stringify(block.data, null, 2)}
          </pre>
        </div>
      );
  }
}
