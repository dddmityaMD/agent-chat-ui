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
import { ConfidenceBadge } from "../confidence-badge";
import { getPendingDisambiguation } from "../disambiguation-card";
import { HistoricalDisambiguationCard } from "@/components/thread/historical-disambiguation-card";
import { ThoughtProcessPane } from "@/components/thread/thought-process-pane";
import type { ThoughtStage } from "@/lib/message-groups";
import { deriveStageDetails, applyStageDetails } from "@/lib/message-groups";
import type { PendingDisambiguation } from "@/lib/types";
import {
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

    return (
      <>
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

            {/* Confidence badge from content only (no sais_ui) */}
            <ConfidenceBadge
              saisUiConfidence={null}
              content={contentString}
            />
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
