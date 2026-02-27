export interface BlockData {
  type: string;
  [key: string]: unknown;
}

export interface TextBlockData extends BlockData {
  type: "text";
  content: string;
}

export interface InterruptCardBlockData extends BlockData {
  type: "interrupt_card";
  card_type: string;
  message: string;
  artifacts?: unknown[];
  rpabv_progress?: Record<string, unknown>;
  decision?: string;
  feedback?: string;
  decided_at?: string;
}

export interface DataTableBlockData extends BlockData {
  type: "data_table";
  columns: string[];
  rows: Record<string, unknown>[];
  title?: string;
}

export interface FlowSummaryBlockData extends BlockData {
  type: "flow_summary";
  flow_type: string;
  stages_completed: number;
  stages_total: number;
  stage_details?: Array<{ id: string; label: string; status: string; subtitle?: string }>;
  duration_ms?: number;
}

export interface AssumptionCardBlockData extends BlockData {
  type: "assumption_card";
  assumptions: Array<{
    assumption_id: string;
    category: string;
    description: string;
    default_value?: string;
    blocking: boolean;
    options: string[];
    confidence: number;
    resolved_value?: string;
    resolved_source?: string;
  }>;
  connector_type: string;
  rpabv_progress?: Record<string, unknown>;
  decision?: Record<string, { action: "confirmed" | "overridden"; value?: string }>;
  decided_at?: string;
}

export interface DiscussionCardBlockData extends BlockData {
  type: "discussion_card";
  questions: Array<{
    question_id: string;
    question: string;
    input_type: "multiple_choice" | "free_text";
    options?: string[];
    required: boolean;
    context?: string;
  }>;
  connector_type: string;
  rpabv_progress?: Record<string, unknown>;
  answers?: Record<string, { value: string }>;
  decided_at?: string;
}

export interface EntityItem {
  entity_type: string;
  uri: string;
  connector_type: string;
  display_name: string;
  description?: string;
  subtitle?: string;
  freshness?: string;
  properties: Record<string, unknown>;
  qualified_references: string[];
}

export interface EntityGroup {
  label: string;
  entity_type: string;
  count: number;
  entities: EntityItem[];
}

export interface EntityCardBlockData extends BlockData {
  type: "entity_card";
  groups: EntityGroup[];
  header?: string;
  next_steps?: string[];
  layout: "list" | "grid";
  title?: string;
  source_flow?: string;
  // Backward compat — old flat format
  entities?: EntityItem[];
  summary?: string;
}

export interface FindingsCardBlockData extends BlockData {
  type: "findings_card";
  root_cause?: { statement: string; confidence: number; evidence_ids: string[] };
  key_observations: Array<{ statement: string; confidence: number; evidence_ids?: string[] }>;
  recommended_fix?: { steps: string[]; risks: string[]; validation_steps: string[] };
  rejected_hypotheses: Array<{ statement: string; reason: string }>;
  open_questions: Array<{ question: string; why_missing: string }>;
  next_tests: Array<{ test: string; why: string }>;
  entity_context: Array<{ display_name: string; entity_type: string; uri: string }>;
  source_flow?: string;
}

export interface BlockRendererProps {
  block: BlockData;
  isActive?: boolean;
  onApprove?: () => void;
  onReject?: (feedback?: string) => void;
  onSubmit?: (payload: Record<string, unknown>) => void;
}
