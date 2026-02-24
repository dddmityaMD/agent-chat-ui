import { useStreamContext } from "@/providers/Stream";
import { useState } from "react";
import { toast } from "sonner";

export type SaisInterruptType =
  | "plan_approval"
  | "gate_confirmation"
  | "pipeline_resumption"
  | "research_approval"
  | "verify_approval";

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
    ["plan_approval", "gate_confirmation", "pipeline_resumption", "research_approval", "verify_approval"].includes(v.type) &&
    typeof v.message === "string"
  );
}

export function useInterruptApproval() {
  const thread = useStreamContext();
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const handleApprove = () => {
    try {
      setLoading(true);
      thread.submit({}, {
        command: { resume: { approved: true } },
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
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
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
      });
      toast("Rejected", { description: "Action cancelled.", duration: 3000 });
      setFeedbackText("");
      setShowFeedback(false);
    } catch (error) {
      console.error("Error sending rejection", error);
      toast.error("Error", { description: "Failed to submit rejection.", richColors: true, closeButton: true, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    feedbackText,
    setFeedbackText,
    showFeedback,
    setShowFeedback,
    handleApprove,
    handleReject,
  };
}
