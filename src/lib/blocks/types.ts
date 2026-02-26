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

export interface EntityCardBlockData extends BlockData {
  type: "entity_card";
  entities: Array<{
    entity_type: string;
    uri: string;
    connector_type: string;
    display_name: string;
    properties: Record<string, unknown>;
    qualified_references: string[];
  }>;
  layout: "list" | "grid";
  title?: string;
  source_flow?: string;
}

export interface BlockRendererProps {
  block: BlockData;
  isActive?: boolean;
  onApprove?: () => void;
  onReject?: (feedback?: string) => void;
  onSubmit?: (payload: Record<string, unknown>) => void;
}
