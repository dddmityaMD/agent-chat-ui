/**
 * Shared types for SAIS DataBI frontend.
 */

// --- Blocker types (from backend blockers module) ---

export type BlockerSeverity = 'INFO' | 'WARNING' | 'ERROR';

export type BlockerType =
  | 'MISSING_ENTITY'
  | 'CONNECTOR_UNAVAILABLE'
  | 'AMBIGUOUS_REFERENCE'
  | 'INTENT_UNCLEAR'
  | 'RESOLUTION_FAILED'
  | 'SKILL_UNAVAILABLE'
  | 'SKILL_EXECUTION_FAILED'
  | 'LLM_ERROR'
  | 'PERMISSION_REQUIRED'
  | 'POLICY_VIOLATION';

export const blockerSeverityConfig: Record<BlockerSeverity, { className: string }> = {
  INFO: {
    className: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  },
  WARNING: {
    className: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  },
  ERROR: {
    className: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
  },
};

export const blockerTypeSeverityOverrides: Partial<Record<BlockerType, BlockerSeverity>> = {
  PERMISSION_REQUIRED: 'WARNING',
  POLICY_VIOLATION: 'ERROR',
};

export interface Blocker {
  type: BlockerType;
  severity: BlockerSeverity;
  message: string;
  hint: string;
  what_i_tried?: string[];
  next_action?: string;
  /** Recovery action identifiers: "retry", "switch_model" */
  recovery_actions?: string[];
  metadata?: Record<string, unknown>;
}

export interface PermissionGrant {
  capability: string;
  scope: string;
  granted_at: string;
  expires_at: string | null;
  reason: string | null;
  pending_action_id: string | null;
}

export interface PermissionState {
  grants: PermissionGrant[];
}

export interface PermissionBlockerMetadata {
  summary?: string;
  requested_capability?: string;
  tool_name?: string;
  action_name?: string;
  pending_action_id?: string;
  pending_action?: string;
  agent_reason?: string;
  rule_violated?: string;
  suggestion?: string;
  target?: string;
}

// --- Multi-intent types (from backend multi_intent module) ---

export interface DecomposedIntent {
  /** The intent-specific text extracted from compound query */
  intent_text: string;
  /** Suggested skill name if obvious */
  skill_hint?: string | null;
  /** Indices of intents this depends on */
  depends_on: number[];
  /** True if this intent might modify data */
  is_write_capable: boolean;
}

export interface IntentResult {
  /** Index of the intent in decomposition */
  index: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed (from blocker) */
  error?: string | null;
}

export interface MultiIntentPayload {
  /** List of decomposed intents */
  intents: DecomposedIntent[];
  /** Execution results per intent */
  results: IntentResult[];
  /** True if intents were executed in parallel, false if sequential */
  was_parallel: boolean;
  /** Merged output from all intent executions */
  merged_output: Record<string, unknown>;
}

// --- LLM Health types (from backend llm wrapper / health endpoint) ---

export interface LLMHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_error?: string | null;
  consecutive_failures: number;
}

export interface AvailableModel {
  provider: string;
  model: string;
  operation_type: string;
  is_primary: boolean;
  is_fallback: boolean;
}
