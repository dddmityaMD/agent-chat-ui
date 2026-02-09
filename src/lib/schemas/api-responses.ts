/**
 * Zod schemas for FastAPI response validation.
 *
 * Source of truth: backend/src/sais_agent/api.py
 *
 * NOTE: These schemas use thread-first naming to match the post-migration API (plan 10-06).
 * During Wave 1, the backend still uses case_id. The schemas will match after Wave 2 completes.
 * .passthrough() prevents any mismatch from causing runtime errors.
 *
 * All schemas use .passthrough() for forward compatibility.
 * Validation is warn-and-fallback: safeParse() logs warnings but never crashes the UI.
 */
import { z } from "zod";

// ThreadMetadata shape (matches backend ThreadMetadataOut from plan 10-06)
export const ThreadMetadataSchema = z
  .object({
    thread_id: z.string(),
    workspace_id: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    is_pinned: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    created_at: z.string(),
    last_activity_at: z.string().optional(),
    last_message_preview: z.string().nullable().optional(),
  })
  .passthrough();

// Full thread summary response (nested -- matches backend ThreadSummaryOut)
export const ThreadSummaryResponseSchema = z
  .object({
    thread: ThreadMetadataSchema,
    evidence: z.array(z.record(z.string(), z.unknown())).optional(),
    hypotheses: z.array(z.record(z.string(), z.unknown())).optional(),
    findings: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export const EvidenceItemSchema = z
  .object({
    evidence_id: z.string(),
    thread_id: z.string(),
    type: z.string(),
    title: z.string(),
    payload: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const HealthResponseSchema = z
  .object({
    status: z.string(),
  })
  .passthrough();

export const FindingsSchema = z
  .object({
    version: z.number(),
    content: z.record(z.string(), z.unknown()),
  })
  .passthrough();

/** Generic safe parse with console warning on failure. */
export function safeParseFetch<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[${context}] API response validation warning:`,
      result.error?.issues,
    );
    return data as T; // Fallback: pass through unvalidated
  }
  return result.data;
}
