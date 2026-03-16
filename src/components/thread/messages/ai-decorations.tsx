/**
 * ai-decorations.tsx — LastMessageDecorations component.
 *
 * Renders sais_ui-dependent UI elements (flow badges, blockers, handoffs,
 * build plans, etc.) for the LAST AI message only.
 * Subscribes to useSaisUi() and stream context.
 */

import React, { useState, useRef, useCallback } from "react";
import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import { Loader2 } from "lucide-react";
import { useSaisUi } from "@/hooks/useSaisUi";
import { useInterruptApproval } from "@/hooks/useInterruptApproval";
import { usePermissionState } from "@/providers/Thread";
import { MarkdownText } from "../markdown-text";
import { QueryResults } from "@/components/query";
import { FlowBadge } from "@/components/flow-indicator/FlowBadge";
import { BatchReview } from "@/components/remediation/BatchReview";
import { BlockerMessage } from "../blocker-message";
import { MultiIntentResult } from "../multi-intent-result";
import { ConfidenceBadge } from "../confidence-badge";
import { ClarificationCard, getClarification } from "../clarification-card";
import { DisambiguationCard, getPendingDisambiguation } from "../disambiguation-card";
import { BuildPlanDisplay } from "./build-plan";
import { VerificationBadge } from "./verification-badge";
import { ViewInLineageButton } from "@/components/lineage-link";
import { ThoughtProcessPane } from "@/components/thread/thought-process-pane";
import { getBlockRenderer } from "@/lib/blocks/registry";
import { getApiBaseUrl } from "@/lib/api-url";
import type { BlockData } from "@/lib/blocks/types";
import type { ThoughtStage, StreamingStateValues } from "@/lib/message-groups";
import { deriveStagesFromFlow, deriveStageDetails, applyStageDetails, computeDynamicStageReveal, computeDataDrivenReveal } from "@/lib/message-groups";
import type { PendingDisambiguation, PermissionGrant } from "@/lib/types";
import { HandoffConfirmationCard } from "./ai-cards";
import {
  type MetadataResults,
  FLOW_DISPLAY_NAMES,
  ENTITY_TYPE_LABELS,
  hasMetadataResults,
  toSections,
  getInterruptDecision,
  getHandoffProposal,
  getRemediationProposals,
  getBlockers,
  getConfidenceData,
  getMultiIntentPayload,
  getBuildPlan,
  getBuildPlanStatus,
  getBuildVerificationResult,
} from "./ai-helpers";

/**
 * LastMessageDecorations - Renders sais_ui-dependent UI elements (flow badges,
 * blockers, handoffs, build plans, etc.) for the LAST AI message only.
 *
 * This component calls useSaisUi() and therefore subscribes to stream context.
 * By extracting it into a separate component, historical messages avoid this
 * subscription entirely, preventing unnecessary re-renders (UX-05 fix).
 */
export function LastMessageDecorations({
  message,
  contentString,
  isLoading,
  msgResponseMeta,
  stages,
  streamingValues,
}: {
  message: Message | undefined;
  contentString: string;
  isLoading: boolean;
  msgResponseMeta: Record<string, unknown> | undefined;
  stages?: ThoughtStage[];
  /** Live streaming state — used for progressive stage reveal during streaming */
  streamingValues?: StreamingStateValues;
}) {
  const saisUiData = useSaisUi();
  const thread = useStreamContext();
  const { addPermissionGrant, revokePermissionGrant } = usePermissionState();
  const { isActiveInterrupt, handleApprove, handleReject, handleSubmit } = useInterruptApproval();
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  // Cache streaming stage details so they persist when isLoading->false (interrupt fires)
  const cachedStageDetailsRef = useRef<Record<string, string>>({});

  // Metadata results fallback: use sais_ui when per-message response_metadata is empty
  const msgMetadataResults = msgResponseMeta && typeof msgResponseMeta === "object" && "metadata_results" in msgResponseMeta
    ? (msgResponseMeta as Record<string, unknown>).metadata_results
    : null;
  const perMsgResults = (msgMetadataResults && hasMetadataResults({ metadata_results: msgMetadataResults }))
    ? (msgMetadataResults as MetadataResults)
    : null;
  const saisUiMr = saisUiData.metadataResults.length > 0
    ? saisUiData.metadataResults
    : null;
  const metadataResults = perMsgResults
    ?? (saisUiMr && hasMetadataResults({ metadata_results: saisUiMr }) ? (saisUiMr as unknown as MetadataResults) : null);
  const metadataSections = metadataResults ? toSections(metadataResults) : [];

  if (!perMsgResults && saisUiMr) {
    console.debug("[ai.tsx] Grid fallback: response_metadata empty, using sais_ui.metadata_results",
      { hasResponseMeta: !!msgResponseMeta, responseMetaKeys: msgResponseMeta ? Object.keys(msgResponseMeta as Record<string, unknown>) : [], saisUiMrCount: saisUiMr.length });
  }

  // Extract all sais_ui-dependent data for the last message
  const activeMethodology = saisUiData.methodologyType;
  const handoffProposal = getHandoffProposal(saisUiData.raw);
  const remediationProposals = getRemediationProposals(saisUiData.raw);
  const blockers = getBlockers(saisUiData.raw);
  const multiIntentPayload = getMultiIntentPayload(saisUiData.raw);
  const clarificationData = getClarification(saisUiData.raw);
  const buildPlan = getBuildPlan(saisUiData.raw);
  const buildPlanStatus = getBuildPlanStatus(saisUiData.raw);
  const buildVerificationResult = getBuildVerificationResult(saisUiData.raw);
  const confidenceData = getConfidenceData(saisUiData.raw);

  // Disambiguation: prefer sais_ui, fall back to response_metadata
  const msgPendingDisambiguation = msgResponseMeta?.pending_disambiguation as PendingDisambiguation | undefined;
  const pendingDisambiguation =
    getPendingDisambiguation(saisUiData.raw) ?? (msgPendingDisambiguation ? getPendingDisambiguation({ pending_disambiguation: msgPendingDisambiguation }) : null);

  // Submit helpers
  const { submit: threadSubmit, messages: threadMessages } = thread;

  const handleHandoffConfirm = useCallback(() => {
    if (!handoffProposal) return;
    const targetName =
      FLOW_DISPLAY_NAMES[handoffProposal.target_flow] ||
      handoffProposal.target_flow;
    const confirmMsg: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        { type: "text", text: `Switch to ${targetName}` },
      ] as Message["content"],
    };
    threadSubmit(
      {
        messages: [...threadMessages, confirmMsg],
        handoff_confirmed: true,
        handoff_target: handoffProposal.target_flow,
      } as Record<string, unknown> as any,
      { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
    );
    setHandoffDismissed(true);
  }, [handoffProposal, threadSubmit, threadMessages]);

  const handleClarificationSelect = useCallback(
    (value: string) => {
      const clarifyMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: [{ type: "text", text: value }] as Message["content"],
      };
      threadSubmit(
        { messages: [...threadMessages, clarifyMsg] } as Record<string, unknown> as any,
        { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
      );
    },
    [threadSubmit, threadMessages],
  );

  const handleDisambiguationSelect = useCallback(
    (entityName: string, action: string, nodeId?: string) => {
      const text = action === "skip" ? "None of these match what I meant" : action;
      const contentBlocks: Array<Record<string, unknown>> = [{ type: "text", text }];
      if (nodeId) {
        contentBlocks.push({ type: "entity_selection", node_id: nodeId });
      }
      const disambigMsg: Message = {
        id: uuidv4(),
        type: "human",
        content: contentBlocks as Message["content"],
      };
      threadSubmit(
        { messages: [...threadMessages, disambigMsg] } as Record<string, unknown> as any,
        { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
      );
    },
    [threadSubmit, threadMessages],
  );

  // --- Blocks-first rendering path ---
  const blocks = msgResponseMeta?.blocks as BlockData[] | undefined;
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

  return (
    <>
      {/* Flow badge above message content */}
      {activeMethodology && (
        <div className="mb-1">
          <FlowBadge methodologyType={activeMethodology} />
        </div>
      )}

      {/* Thought process pane (UAT-4) */}
      {(() => {
        const effectiveStages = (stages && stages.length > 0)
          ? stages
          : deriveStagesFromFlow(activeMethodology, saisUiData.raw as Record<string, unknown> | null);
        if (effectiveStages.length === 0) return null;

        let stageDetails: Record<string, string>;
        let minReveal = 0;

        if (isLoading) {
          const hasStreamData = streamingValues && Object.keys(streamingValues).length > 0;
          stageDetails = hasStreamData
            ? deriveStageDetails(streamingValues)
            : deriveStageDetails({ sais_ui: saisUiData.raw } as StreamingStateValues);
          if (Object.keys(stageDetails).length > 0) {
            cachedStageDetailsRef.current = { ...cachedStageDetailsRef.current, ...stageDetails };
          }
          const latestSaisUi = saisUiData.raw as Record<string, unknown> | undefined;
          const dynamicReveal = computeDynamicStageReveal(latestSaisUi, effectiveStages);
          const staticReveal = hasStreamData
            ? computeDataDrivenReveal(streamingValues, effectiveStages)
            : 0;
          minReveal = Math.max(dynamicReveal, staticReveal);
        } else {
          const intentFromMeta = msgResponseMeta?.intent as string | undefined;
          const confFromMeta = msgResponseMeta?.intent_confidence as number | undefined;
          const entitiesFromMeta = msgResponseMeta?.resolved_entities as
            Record<string, { name?: string; entity_type?: string }> | undefined;
          const catalogCount = metadataSections.length > 0
            ? {
                count: metadataSections.reduce((sum, s) => sum + s.total, 0),
                entity_type: metadataSections.length === 1 ? metadataSections[0].entity_type : "items",
              }
            : undefined;
          stageDetails = deriveStageDetails({
            intent: intentFromMeta,
            intent_confidence: confFromMeta,
            resolved_entities: entitiesFromMeta,
            evidence_result: catalogCount ? { catalog_count: catalogCount } : undefined,
          });
          stageDetails = { ...cachedStageDetailsRef.current, ...stageDetails };
        }

        const enrichedStages = applyStageDetails(effectiveStages, stageDetails);
        return (
          <ThoughtProcessPane
            stages={enrichedStages}
            isStreaming={isLoading}
            startCollapsed={false}
            minRevealCount={minReveal}
          />
        );
      })()}

      {/* --- BLOCKS-FIRST RENDERING PATH --- */}
      {hasBlocks ? (
        <div className="flex flex-col gap-2">
          {blocks!.map((block, i) => {
            const Renderer = getBlockRenderer(block.type);
            if (Renderer) {
              if (block.type === "interrupt_card") {
                const cardType = (block as { card_type?: string }).card_type ?? "";
                return (
                  <Renderer
                    key={`block-${i}`}
                    block={block}
                    isActive={isActiveInterrupt(cardType)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                );
              }
              if (block.type === "assumption_card") {
                return (
                  <Renderer
                    key={`block-${i}`}
                    block={block}
                    isActive={isActiveInterrupt("assumptions_approval")}
                    onSubmit={handleSubmit}
                  />
                );
              }
              if (block.type === "discussion_card") {
                return (
                  <Renderer
                    key={`block-${i}`}
                    block={block}
                    isActive={isActiveInterrupt("discussion_approval")}
                    onSubmit={handleSubmit}
                  />
                );
              }
              return <Renderer key={`block-${i}`} block={block} />;
            }
            return (
              <div key={`block-${i}`} className="py-1" data-testid="ai-message-content">
                <MarkdownText>{(block as { content?: string }).content ?? JSON.stringify(block)}</MarkdownText>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* --- LEGACY RENDERING PATH --- */}

          {/* Multi-intent decomposition */}
          {multiIntentPayload && (
            <MultiIntentResult payload={multiIntentPayload} />
          )}

          {/* Disambiguation card */}
          {pendingDisambiguation && pendingDisambiguation.candidates.length > 0 && (
            <DisambiguationCard
              payload={pendingDisambiguation}
              onSelect={handleDisambiguationSelect}
            />
          )}

          {/* Interrupt decision badge (read-only legacy) */}
          {(() => {
            const interruptDecision = getInterruptDecision(msgResponseMeta);
            if (!interruptDecision) return null;
            return (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  interruptDecision.decision === "approved"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                }`}>
                  {interruptDecision.decision === "approved" ? "Approved" : "Rejected"}
                </div>
                {interruptDecision.feedback && (
                  <p className="text-xs italic">{interruptDecision.feedback}</p>
                )}
              </div>
            );
          })()}

          {/* Synthesis indicator */}
          {isLoading && contentString.length === 0 && !pendingDisambiguation && (
            <div className="py-1 flex items-center gap-2 text-muted-foreground" data-testid="synthesis-indicator">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Synthesizing answer...</span>
            </div>
          )}

          {/* AI text content */}
          {contentString.length > 0 && !getInterruptDecision(msgResponseMeta)
            && !(pendingDisambiguation && pendingDisambiguation.candidates.length > 0) && (
            <div className="py-1" data-testid="ai-message-content">
              <MarkdownText>{contentString}</MarkdownText>
            </div>
          )}

          {/* Metadata grids */}
          {metadataSections.map((section) => (
            section.items.length > 0 && (
              <details
                className="mt-4"
                key={section.entity_type}
                open={true}
                data-testid={`entity-grid-section-${section.entity_type}`}
              >
                {metadataSections.length > 1 && (
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors">
                    {ENTITY_TYPE_LABELS[section.entity_type] || section.entity_type} ({section.total})
                  </summary>
                )}
                <QueryResults
                  evidence={section.items.map((item, idx) => ({
                    id: String(item.id || item.canonical_key || `item-${idx}`),
                    entity_type: section.entity_type,
                    ...item,
                  }))}
                  entityType={section.entity_type}
                  totalCount={section.total}
                  isLoading={isLoading}
                />
              </details>
            )
          ))}

          {/* Confidence badge */}
          <ConfidenceBadge
            saisUiConfidence={confidenceData}
            content={contentString}
          />

          {/* Lineage deep-link button */}
          <ViewInLineageButton entities={saisUiData.groundedEntities} />

          {/* Build plan display */}
          {buildPlan && buildPlanStatus === "proposed" && (
            <div className="mt-3">
              <BuildPlanDisplay plan={buildPlan} />
            </div>
          )}

          {/* Build execution progress */}
          {buildPlanStatus === "executing" && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"></div>
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Executing build plan...
                </span>
              </div>
            </div>
          )}

          {/* Build verification result */}
          {buildVerificationResult && (
            <div className="mt-3">
              <VerificationBadge result={buildVerificationResult} />
            </div>
          )}

          {/* Handoff confirmation card */}
          {handoffProposal && !handoffProposal.confirmed && (
            <HandoffConfirmationCard
              handoff={handoffProposal}
              currentFlow={activeMethodology}
              onConfirm={handleHandoffConfirm}
              onDismiss={() => setHandoffDismissed(true)}
              dismissed={handoffDismissed}
            />
          )}

          {/* Remediation proposals */}
          {remediationProposals && remediationProposals.length > 0 && (
            <div className="mt-3" data-testid="remediation-proposals">
              <BatchReview
                batchId={
                  ((saisUiData.raw as Record<string, unknown>)
                    ?.remediation_batch_id as string) ||
                  `msg-${message?.id ?? "unknown"}`
                }
                threadId={
                  ((saisUiData.raw as Record<string, unknown>)?.thread_id as string) ||
                  ((saisUiData.raw as Record<string, unknown>)?.case_id as string) ||
                  ""
                }
                proposals={remediationProposals}
                apiBaseUrl={getApiBaseUrl()}
              />
            </div>
          )}

          {/* Blocker messages */}
          {blockers && blockers.length > 0 && (
            <div className="mt-3" data-testid="blocker-messages">
              {blockers.map((blocker, idx) => (
                <BlockerMessage
                  key={`blocker-${idx}`}
                  blocker={blocker}
                  onAction={(action?: string) => {
                    const text = action || blocker.next_action;
                    if (text) {
                      if (text.startsWith("grant write")) {
                        const scopeMatch = text.match(/scope=([^\s]+)/);
                        const pendingMatch = text.match(/pending_action_id=([^\s]+)/);
                        const reasonMatch = text.match(/reason="([\s\S]*)"$/);
                        const grant: PermissionGrant = {
                          capability: "WRITE",
                          scope: scopeMatch?.[1] ?? "once",
                          granted_at: new Date().toISOString(),
                          expires_at:
                            scopeMatch?.[1] === "1h"
                              ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
                              : null,
                          reason: reasonMatch?.[1] ?? null,
                          pending_action_id: pendingMatch?.[1] ?? null,
                        };
                        addPermissionGrant(grant);
                      }

                      if (text.startsWith("deny write")) {
                        const pendingMatch = text.match(/pending_action_id=([^\s]+)/);
                        revokePermissionGrant(pendingMatch?.[1] ?? null);
                      }

                      const actionMsg: Message = {
                        id: uuidv4(),
                        type: "human",
                        content: [{ type: "text", text }] as Message["content"],
                      };
                      thread.submit(
                        { messages: [...thread.messages, actionMsg] } as Record<string, unknown> as any,
                        { streamMode: ["values"], streamSubgraphs: true, streamResumable: true },
                      );
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Clarification card */}
          {clarificationData && (
            <ClarificationCard
              data={clarificationData}
              onSelect={handleClarificationSelect}
            />
          )}
        </>
      )}
    </>
  );
}
