"use client";

import type { PanelBlock, BlockState } from "@/lib/panel-blocks/types";

// L1 Perception
import { AgentStatusBlock } from "./blocks/l1/agent-status";

// Action
import { PlanApprovalBlock } from "./blocks/action/plan-approval";
import { DisambiguationBlock } from "./blocks/action/disambiguation";
import { ConfirmationBlock } from "./blocks/action/confirmation";

// L2 Comprehension
import { EntityMapBlock } from "./blocks/l2/entity-map";
import { EvidenceCollectionBlock } from "./blocks/l2/evidence-collection";
import { WorkflowPositionBlock } from "./blocks/l2/workflow-position";
import { ConfidenceAssessmentBlock } from "./blocks/l2/confidence-assessment";
import { DataProfileBlock } from "./blocks/l2/data-profile";
import { RelationshipsBlock } from "./blocks/l2/relationships";
import { DecisionRecordBlock } from "./blocks/l2/decision-record";

// L3 Projection
import { FindingsBlock } from "./blocks/l3/findings";
import { ArtifactListBlock } from "./blocks/l3/artifact-list";
import { NextStepsBlock } from "./blocks/l3/next-steps";
import { PlanPreviewBlock } from "./blocks/l3/plan-preview";
import { VerificationBlock } from "./blocks/l3/verification";
import { KpiSuggestionsBlock } from "./blocks/l3/kpi-suggestions";
import { RoadmapBlock } from "./blocks/l3/roadmap";
import { BiDashboardMetadataBlock } from "./blocks/l3/bi-dashboard-metadata";

interface BlockRendererProps {
  block: PanelBlock;
  onAction?: (actionType: string, payload: Record<string, unknown>) => void;
  onCanvasOpen?: (contentType: string, contentData: unknown) => void;
}

/**
 * Routes block type string to the correct component.
 *
 * 19 built components: 1 L1, 3 Action, 7 L2, 8 L3.
 * All block types have dedicated components — no JSON fallbacks.
 */
export function BlockRenderer({
  block,
  onAction,
  onCanvasOpen,
}: BlockRendererProps) {
  const state = block.state as BlockState;

  switch (block.type) {
    // L1
    case "agent-status":
      return <AgentStatusBlock block={block} state={state} />;

    // Action
    case "plan-approval":
      return (
        <PlanApprovalBlock block={block} state={state} onAction={onAction} />
      );
    case "entity-disambiguation":
      return (
        <DisambiguationBlock block={block} state={state} onAction={onAction} />
      );
    case "confirmation":
      return (
        <ConfirmationBlock block={block} state={state} onAction={onAction} />
      );

    // L2
    case "entity-map":
      return (
        <EntityMapBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "evidence-collection":
      return (
        <EvidenceCollectionBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "workflow-position":
      return <WorkflowPositionBlock block={block} state={state} />;
    case "confidence-assessment":
      return <ConfidenceAssessmentBlock block={block} state={state} />;
    case "data-profile":
      return (
        <DataProfileBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "relationships":
      return (
        <RelationshipsBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "decision-record":
      return <DecisionRecordBlock block={block} state={state} />;

    // L3
    case "findings":
      return <FindingsBlock block={block} state={state} />;
    case "artifact-list":
      return (
        <ArtifactListBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "next-steps":
      return (
        <NextStepsBlock block={block} state={state} onAction={onAction} />
      );
    case "plan-preview":
      return (
        <PlanPreviewBlock
          block={block}
          state={state}
          onCanvasOpen={onCanvasOpen}
        />
      );
    case "verification":
      return <VerificationBlock block={block} state={state} />;
    case "kpi-suggestions":
      return (
        <KpiSuggestionsBlock
          block={block}
          state={state}
          onAction={onAction}
        />
      );
    case "roadmap":
      return <RoadmapBlock block={block} state={state} />;
    case "bi-dashboard-metadata":
      return <BiDashboardMetadataBlock block={block} state={state} />;

    default:
      // Unexpected block type — minimal debug display
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
