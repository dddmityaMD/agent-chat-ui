/**
 * ai-cards.tsx — Card sub-components for AI messages:
 * HandoffConfirmationCard, Interrupt, CustomComponent.
 */

import React from "react";
import { Fragment } from "react/jsx-runtime";
import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import {
  isSaisInterruptSchema,
  isSaisInterruptType,
} from "@/hooks/useInterruptApproval";
import { ThreadView } from "../agent-inbox";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";
import { ArrowRightLeft, X } from "lucide-react";
import type { HandoffProposal } from "./ai-helpers";
import { FLOW_DISPLAY_NAMES } from "./ai-helpers";

// ---- CustomComponent ----

export function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const uiMessages = values.ui as
    | Array<{ id: string; metadata?: Record<string, unknown> }>
    | undefined;
  const customComponents = uiMessages?.filter(
    (ui: { metadata?: Record<string, unknown> }) =>
      ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent: any) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread as any}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

// ---- Interrupt ----

interface InterruptProps {
  interrupt?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

export function Interrupt({
  interrupt,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  if (!(isLastMessage || hasNoAIOrToolMessages)) return null;
  if (!interrupt) return null;

  // Agent inbox HITL interrupts (action_requests + review_configs)
  if (isAgentInboxInterruptSchema(interrupt)) {
    return <ThreadView interrupt={interrupt} />;
  }

  // Extract interrupt value for SAIS-specific handling
  const interruptValue = Array.isArray(interrupt)
    ? (interrupt[0]?.value ?? interrupt[0])
    : ((interrupt as any)?.value ?? interrupt);

  // SAIS interrupt types — in block-based architecture, interrupt cards are rendered
  // as message blocks in chronological position. The Interrupt component no longer
  // renders them — the card block handles active state + buttons.
  if (
    isSaisInterruptSchema(interruptValue) ||
    isSaisInterruptType(interruptValue)
  ) {
    return null;
  }

  // Fallback: generic JSON view
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
        interrupt) as Record<string, any>);
  return <GenericInterruptView interrupt={fallbackValue} />;
}

// ---- HandoffConfirmationCard ----

/**
 * Shows when a flow proposes a handoff to another flow.
 * User must explicitly confirm or decline the transition.
 */
export function HandoffConfirmationCard({
  handoff,
  currentFlow,
  onConfirm,
  onDismiss,
  dismissed,
}: {
  handoff: HandoffProposal;
  currentFlow: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
  dismissed: boolean;
}) {
  if (dismissed || handoff.confirmed) return null;

  const targetName =
    FLOW_DISPLAY_NAMES[handoff.target_flow] || handoff.target_flow;
  const currentName = currentFlow
    ? FLOW_DISPLAY_NAMES[currentFlow] || currentFlow
    : "current flow";

  return (
    <div
      className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
      data-testid="handoff-confirmation"
    >
      <div className="mb-2 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Flow transition suggested
        </span>
      </div>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
        {currentName} suggests switching to <strong>{targetName}</strong>
        {handoff.reason ? `: ${handoff.reason}` : "."}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          data-testid="handoff-confirm"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Switch to {targetName}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800"
          data-testid="handoff-dismiss"
        >
          <X className="h-3 w-3" />
          Stay in {currentName}
        </button>
      </div>
    </div>
  );
}
