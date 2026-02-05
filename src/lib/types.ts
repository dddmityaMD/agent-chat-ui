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
  | 'SKILL_EXECUTION_FAILED';

export interface Blocker {
  type: BlockerType;
  severity: BlockerSeverity;
  message: string;
  hint: string;
  what_i_tried?: string[];
  next_action?: string;
  metadata?: Record<string, unknown>;
}

// --- Resolution steps (for debugging UI) ---

export interface ResolutionStep {
  /** Scope name: "thread_context" | "workspace" | "catalog" */
  scope: string;
  /** What was attempted: "Checking thread context..." */
  action: string;
  /** Outcome: "found 'sales' mentioned" | "2 matches" */
  result: string;
  /** Confidence score (0.0-1.0) */
  confidence?: number;
  /** ISO timestamp */
  timestamp?: string;
}

export interface ResolutionStepsPayload {
  type: 'resolution_steps';
  steps: ResolutionStep[];
  /** Summary message: "Using sales_orders (high confidence)" */
  final_result?: string;
}

// --- Disambiguation types ---

export interface DisambiguationOption {
  /** 1-based index */
  index: number;
  /** Full entity dict */
  entity: Record<string, unknown>;
  /** Display label (entity name) */
  label: string;
  /** Type label (e.g., "table", "column", "dbt model") */
  type_label: string;
  /** Context hint (e.g., "used in Sales Dashboard") */
  context_hint?: string;
}

export interface DisambiguationPayload {
  type: 'disambiguation';
  /** The ambiguous mention */
  mention: string;
  /** Question to display */
  question: string;
  /** Up to 4 options per CONTEXT.md */
  options: DisambiguationOption[];
  /** Whether free text input is allowed */
  allow_free_text: boolean;
}

export interface DisambiguationSelection {
  /** 1-based index of selected option */
  index?: number;
  /** Free text clarification */
  freeText?: string;
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
