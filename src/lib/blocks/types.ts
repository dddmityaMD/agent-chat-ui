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

export interface BlockRendererProps {
  block: BlockData;
  isActive?: boolean;
  onApprove?: () => void;
  onReject?: (feedback?: string) => void;
}
