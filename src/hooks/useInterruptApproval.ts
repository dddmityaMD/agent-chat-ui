import { useStreamContext } from "@/providers/Stream";
import { useState } from "react";
import { toast } from "sonner";

export type SaisInterruptType =
  | "plan_approval"
  | "gate_confirmation"
  | "pipeline_resumption"
  | "research_approval"
  | "verify_approval"
  | "assumptions_approval"
  | "discussion_approval";

export interface SaisInterruptArtifact {
  type: string;         // e.g., "models_found", "schema_discovered", "dbt_run_output"
  label: string;        // Human-readable label
  items?: any[];        // Optional list of items
  summary?: string;     // Optional summary text
}

export interface SaisInterruptValue {
  type: SaisInterruptType;
  message: string;
  plan?: Record<string, any>;
  artifacts?: SaisInterruptArtifact[];  // Gate-specific artifacts (research, verify)
  rpabv_level?: number;
  rpabv_progress?: {
    level: number;
    stage: string;
    step_index: number | null;
    total_steps: number | null;
    completed_steps: number[];
    failed_step: number | null;
  };
  rpabv_status?: string;
  intent?: string;
  entities?: string[];
  step_index?: number;
  total_steps?: number;
}

/**
 * Type guard: checks if an interrupt value is a SAIS-specific interrupt
 * (plan_approval, gate_confirmation, pipeline_resumption, research_approval, verify_approval).
 * Returns false for HITLRequest-shaped interrupts (those go to agent-inbox).
 */
export function isSaisInterruptSchema(value: unknown): value is SaisInterruptValue {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" &&
    ["plan_approval", "gate_confirmation", "pipeline_resumption", "research_approval", "verify_approval", "assumptions_approval", "discussion_approval"].includes(v.type) &&
    typeof v.message === "string"
  );
}

/**
 * Check if an interrupt value matches a SAIS interrupt type but only by the
 * `type` field (the new pre-gate/gate split emits minimal interrupt payloads
 * that may not include `message`).
 */
export function isSaisInterruptType(value: unknown): value is { type: SaisInterruptType } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" &&
    ["plan_approval", "gate_confirmation", "pipeline_resumption", "research_approval", "verify_approval", "assumptions_approval", "discussion_approval"].includes(v.type)
  );
}

/**
 * Hook for interrupt approval — block-based architecture (Phase 23.4-05).
 *
 * The hook provides:
 * - `isActiveInterrupt(cardType)`: whether a given card_type matches the current interrupt
 * - `onApprove()`: send approve command via LangGraph resume
 * - `onReject(feedback?)`: send reject command with optional feedback
 * - `loading`: whether a submit is in progress
 *
 * UI state (showFeedbackInput, feedback text) is managed by the
 * InterruptCardBlock component itself via useState.
 */
export function useInterruptApproval() {
  const thread = useStreamContext();
  const [loading, setLoading] = useState(false);

  /**
   * Extract the SAIS interrupt type from the current thread interrupt, if any.
   * The new gate nodes emit `interrupt({type: "plan_approval"})` etc.
   */
  const getActiveInterruptType = (): string | null => {
    const interrupt = thread.interrupt;
    if (!interrupt) return null;

    // LangGraph may wrap in array [{value: {type: ...}}] or provide directly
    const raw = Array.isArray(interrupt)
      ? (interrupt[0]?.value ?? interrupt[0])
      : ((interrupt as any)?.value ?? interrupt);

    if (isSaisInterruptType(raw)) {
      return raw.type;
    }
    // Also support the old full-payload schema for backwards compatibility
    if (isSaisInterruptSchema(raw)) {
      return raw.type;
    }
    return null;
  };

  /**
   * Check if a specific card_type matches the current active interrupt.
   */
  const isActiveInterrupt = (cardType: string): boolean => {
    return getActiveInterruptType() === cardType;
  };

  const handleApprove = () => {
    try {
      setLoading(true);
      thread.submit({}, {
        command: { resume: { approved: true } },
        optimisticValues: (prev) => ({
          ...prev,
          messages: prev.messages ?? [],
        }),
      });
      toast("Approved", { description: "Proceeding with the action.", duration: 3000 });
    } catch (error) {
      console.error("Error sending approval", error);
      toast.error("Error", { description: "Failed to submit approval.", richColors: true, closeButton: true, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = (feedback?: string) => {
    try {
      setLoading(true);
      const resumeValue: Record<string, unknown> = { approved: false };
      if (feedback?.trim()) {
        resumeValue.feedback = feedback.trim();
      }
      thread.submit({}, {
        command: { resume: resumeValue },
        optimisticValues: (prev) => ({
          ...prev,
          messages: prev.messages ?? [],
        }),
      });
      toast("Rejected", { description: "Action cancelled.", duration: 3000 });
    } catch (error) {
      console.error("Error sending rejection", error);
      toast.error("Error", { description: "Failed to submit rejection.", richColors: true, closeButton: true, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generic submit for structured payloads (assumption decisions, discussion answers).
   * The underlying thread.submit() is payload-agnostic — this exposes that capability
   * to renderers that need custom resume payloads beyond simple approved/rejected.
   */
  const handleSubmit = (payload: Record<string, unknown>) => {
    try {
      setLoading(true);
      thread.submit({}, {
        command: { resume: payload },
        optimisticValues: (prev) => ({
          ...prev,
          messages: prev.messages ?? [],
        }),
      });
      toast("Submitted", { description: "Response sent.", duration: 3000 });
    } catch (error) {
      console.error("Error sending submit", error);
      toast.error("Error", { description: "Failed to submit response.", richColors: true, closeButton: true, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    isActiveInterrupt,
    getActiveInterruptType,
    handleApprove,
    handleReject,
    handleSubmit,
  };
}
