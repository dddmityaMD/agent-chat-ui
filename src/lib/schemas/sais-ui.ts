/**
 * Zod schema for sais_ui stream state -- the most critical data boundary.
 *
 * Source of truth: backend/src/sais_agent/main_graph.py AgentState.sais_ui
 *
 * All schemas use .passthrough() for forward compatibility with new backend fields.
 * Validation is warn-and-fallback: safeParse() logs warnings but never crashes the UI.
 */
import { z } from "zod";

export const BlockerSchema = z
  .object({
    type: z.string(),
    severity: z.enum(["INFO", "WARNING", "ERROR"]),
    message: z.string(),
    hint: z.string(),
    what_i_tried: z.array(z.string()).optional(),
    recovery_actions: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const PermissionGrantSchema = z
  .object({
    capability: z.string(),
    scope: z.string(),
    granted_at: z.string(),
    expires_at: z.string().nullable(),
    pending_action_id: z.string().nullable(),
  })
  .passthrough();

export const SaisUiSchema = z
  .object({
    blockers: z.array(BlockerSchema).optional(),
    case_status: z.string().optional(),
    active_flow: z.string().nullable().optional(),
    handoff: z.record(z.string(), z.unknown()).nullable().optional(),
    evidence: z.array(z.record(z.string(), z.unknown())).optional(),
    findings: z.record(z.string(), z.unknown()).nullable().optional(),
    confidence: z.record(z.string(), z.unknown()).nullable().optional(),
    permissions: z
      .object({
        grants: z.array(PermissionGrantSchema).optional(),
      })
      .passthrough()
      .optional(),
    multi_intent: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export type SaisUi = z.infer<typeof SaisUiSchema>;

/** Parse sais_ui from stream state with warn-and-fallback. */
export function parseSaisUi(raw: unknown): SaisUi | null {
  if (!raw || typeof raw !== "object") return null;
  const result = SaisUiSchema.safeParse(raw);
  if (!result.success) {
    console.warn("[sais_ui] validation warning:", result.error?.issues);
    // Fallback: return raw as-is (don't crash on validation failure)
    return raw as SaisUi;
  }
  return result.data;
}
