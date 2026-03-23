/**
 * ai-historical.tsx — HistoricalMessageContent component.
 *
 * Renders content for non-last AI messages. Does NOT subscribe to
 * useSaisUi() or stream context for sais_ui data, preventing
 * unnecessary re-renders when new stream data arrives (UX-05 fix).
 */

import React from "react";
import { Message } from "@langchain/langgraph-sdk";
import { MarkdownText } from "../markdown-text";
import { QueryResults } from "@/components/query";
import { ConfidenceBadge } from "../confidence-badge";
import { getPendingDisambiguation } from "../disambiguation-card";
import { HistoricalDisambiguationCard } from "@/components/thread/historical-disambiguation-card";
import { ThoughtProcessPane } from "@/components/thread/thought-process-pane";
import { getBlockRenderer } from "@/lib/blocks/registry";
import type { BlockData } from "@/lib/blocks/types";
import type { ThoughtStage } from "@/lib/message-groups";
import { deriveStageDetails, applyStageDetails } from "@/lib/message-groups";
import type { PendingDisambiguation } from "@/lib/types";
import {
  type MetadataResults,
  ENTITY_TYPE_LABELS,
  hasMetadataResults,
  toSections,
  getInterruptDecision,
} from "./ai-helpers";

/**
 * HistoricalMessageContent - Renders content for non-last AI messages.
 * Does NOT subscribe to useSaisUi() or stream context for sais_ui data,
 * so it will not re-render when new stream data arrives (UX-05 fix).
 *
 * Per-message data (from response_metadata) is still rendered for historical
 * messages (metadata grids, disambiguation from response_metadata).
 */
export const HistoricalMessageContent = React.memo(
  function HistoricalMessageContent({
    message,
    contentString,
    msgResponseMeta,
    stages,
    nextHumanMessage,
  }: {
    message: Message | undefined;
    contentString: string;
    msgResponseMeta: Record<string, unknown> | undefined;
    stages?: ThoughtStage[];
    nextHumanMessage?: Message;
  }) {
    // Per-message metadata_results from response_metadata (not from sais_ui)
    const msgMetadataResults =
      msgResponseMeta &&
      typeof msgResponseMeta === "object" &&
      "metadata_results" in msgResponseMeta
        ? (msgResponseMeta as Record<string, unknown>).metadata_results
        : null;
    const perMsgResults =
      msgMetadataResults &&
      hasMetadataResults({ metadata_results: msgMetadataResults })
        ? (msgMetadataResults as MetadataResults)
        : null;
    const metadataSections = perMsgResults ? toSections(perMsgResults) : [];

    // Per-message disambiguation from response_metadata
    const msgPendingDisambiguation = msgResponseMeta?.pending_disambiguation as
      | PendingDisambiguation
      | undefined;
    const pendingDisambiguation = msgPendingDisambiguation
      ? getPendingDisambiguation({
          pending_disambiguation: msgPendingDisambiguation,
        })
      : null;

    // Interrupt decision record (historical gate cards)
    const interruptDecision = getInterruptDecision(msgResponseMeta);

    // --- Blocks-first rendering check ---
    const blocks = msgResponseMeta?.blocks as BlockData[] | undefined;
    const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

    return (
      <>
        {/* Thought process pane removed — Phase 49 block panel replaces it */}

        {/* --- BLOCKS-FIRST RENDERING PATH --- */}
        {hasBlocks ? (
          <div className="flex flex-col gap-2">
            {blocks!.map((block, i) => {
              const Renderer = getBlockRenderer(block.type);
              if (Renderer) {
                return (
                  <Renderer
                    key={`block-${i}`}
                    block={block}
                  />
                );
              }
              return (
                <div
                  key={`block-${i}`}
                  className="py-1"
                  data-testid="ai-message-content"
                >
                  <MarkdownText>
                    {(block as { content?: string }).content ??
                      JSON.stringify(block)}
                  </MarkdownText>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* --- LEGACY RENDERING PATH --- */}

            {/* Historical interrupt decision badge */}
            {interruptDecision && (
              <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    interruptDecision.decision === "approved"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  }`}
                >
                  {interruptDecision.decision === "approved"
                    ? "Approved"
                    : "Rejected"}
                </div>
                {interruptDecision.feedback && (
                  <p className="text-xs italic">{interruptDecision.feedback}</p>
                )}
              </div>
            )}

            {/* Historical disambiguation card */}
            {pendingDisambiguation &&
              pendingDisambiguation.candidates.length > 0 && (
                <HistoricalDisambiguationCard
                  payload={pendingDisambiguation}
                  nextHumanMessage={nextHumanMessage}
                />
              )}

            {/* AI text content */}
            {contentString.length > 0 &&
              !interruptDecision &&
              !(
                pendingDisambiguation &&
                pendingDisambiguation.candidates.length > 0
              ) && (
                <div
                  className="py-1"
                  data-testid="ai-message-content"
                >
                  <MarkdownText>{contentString}</MarkdownText>
                </div>
              )}

            {/* Per-message metadata grids */}
            {metadataSections.map(
              (section) =>
                section.items.length > 0 && (
                  <details
                    className="mt-4"
                    key={section.entity_type}
                    open={true}
                    data-testid={`entity-grid-section-${section.entity_type}`}
                  >
                    {metadataSections.length > 1 && (
                      <summary className="text-muted-foreground hover:text-foreground mb-2 cursor-pointer text-xs font-medium tracking-wide uppercase transition-colors">
                        {ENTITY_TYPE_LABELS[section.entity_type] ||
                          section.entity_type}{" "}
                        ({section.total})
                      </summary>
                    )}
                    <QueryResults
                      evidence={section.items.map((item, idx) => ({
                        id: String(
                          item.id || item.canonical_key || `item-${idx}`,
                        ),
                        entity_type: section.entity_type,
                        ...item,
                      }))}
                      entityType={section.entity_type}
                      totalCount={section.total}
                      isLoading={false}
                    />
                  </details>
                ),
            )}

            {/* Confidence badge from content only (no sais_ui) */}
            <ConfidenceBadge
              saisUiConfidence={null}
              content={contentString}
            />
          </>
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      prev.message?.id === next.message?.id &&
      prev.contentString === next.contentString &&
      prev.msgResponseMeta === next.msgResponseMeta &&
      prev.stages === next.stages &&
      prev.nextHumanMessage?.id === next.nextHumanMessage?.id
    );
  },
);
