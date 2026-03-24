/**
 * Panel Block Type System (Phase 49-01)
 *
 * Defines the SA-layered block model for the panel:
 * - SALevel: 4 cognitive layers (action, l1, l2, l3)
 * - PanelBlock: universal block interface
 * - BlockUpdateEvent: D-18 SSE event shape
 * - Block data interfaces for all block types
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Situational Awareness level (Endsley SA model) */
export type SALevel = "action" | "l1" | "l2" | "l3";

/** Block lifecycle state */
export type BlockState = "loading" | "populated" | "complete";

/** Universal panel block interface */
export interface PanelBlock {
  id: string;
  type: string;
  level: SALevel;
  data: unknown;
  priority: number; // 0-1, higher = more prominent
  state: BlockState;
  updatedAt: number; // Date.now() timestamp
  turnId?: string;
}

/**
 * D-18: block_update SSE event shape.
 * Backend emits these; the Zustand block store accepts them.
 */
export interface BlockUpdateEvent {
  block_id: string;
  sa_level: SALevel;
  action: "upsert" | "remove";
  data: Record<string, unknown>;
  source_tool?: string;
}

// ---------------------------------------------------------------------------
// L1 Perception block data
// ---------------------------------------------------------------------------

/** L1: Single subagent execution entry */
export interface AgentStatusEntry {
  subagent_id: string;
  status: "active" | "complete";
  iteration?: { current: number; max: number };
  tool?: { name: string };
}

/** L1: Agent status — chronological list of subagent executions */
export interface AgentStatusData {
  entries: AgentStatusEntry[];
}

// ---------------------------------------------------------------------------
// L2 Comprehension block data
// ---------------------------------------------------------------------------

/** L2: Resolved entities with confidence and disambiguation state */
export interface EntityMapData {
  entities: Array<{
    name: string;
    type: string;
    confidence: number;
    resolved: boolean;
  }>;
}

/** L2: Evidence items grouped by connector */
export interface EvidenceCollectionData {
  items: Array<{
    source: string;
    tool_name: string;
    finding: string;
    quality_flag: string;
  }>;
  count: number;
}

/** L2: Column stats and quality issues */
export interface DataProfileData {
  columns: Array<{
    name: string;
    type: string;
    null_rate: number;
    cardinality: number;
  }>;
}

/** L2: Multi-step workflow breadcrumb */
export interface WorkflowPositionData {
  workflow_id: string;
  steps: Array<{ name: string; status: string }>;
  current_index: number;
}

/** L2: Maturity level and sufficiency gaps */
export interface ConfidenceAssessmentData {
  maturity_level: "L1" | "L2" | "L3" | "L4";
  score: number;
  gaps: string[];
}

/** L2: Detected relationships and lineage context */
export interface RelationshipsData {
  relationships: Array<{ from: string; to: string; type: string }>;
}

/** L2: Thread summary — always-on context overview */
export interface ThreadSummaryData {
  entities: Array<{ name: string; type: string }>;
  toolsUsed: Array<{ name: string; count: number }>;
  sourcesTouched: string[];
  turnCount: number;
}

/** L2: Decision record — resolved action block (D-10) */
export interface DecisionRecordData {
  decision: string;
  action: "approved" | "rejected" | "selected";
  details?: string;
  resolvedAt: string;
}

// ---------------------------------------------------------------------------
// L3 Projection block data
// ---------------------------------------------------------------------------

/** L3: Root cause, observations, open questions */
export interface FindingsData {
  root_cause: string;
  observations: string[];
  confidence: number;
  evidence_refs: string[];
}

/** L3: Build plan steps with SQL preview and impact */
export interface PlanPreviewData {
  steps: Array<{ description: string; sql?: string }>;
  impact: { new_files: number; modified_files: number };
  risk: string;
}

/** L3: Files created/modified with metadata */
export interface ArtifactListData {
  artifacts: Array<{
    path: string;
    operation: string;
    language?: string;
    line_count?: number;
    /** File content for canvas code preview */
    code?: string;
  }>;
}

/** L3: Verification layers with pass/fail */
export interface VerificationData {
  layers: Record<string, { passed: boolean; summary: string }>;
}

/** L3: Discovered KPIs with register action */
export interface KpiSuggestionsData {
  suggestions: Array<{
    name: string;
    formula: string;
    registered: boolean;
  }>;
}

/** L3: Recommended follow-up actions */
export interface NextStepsData {
  suggestions: Array<{ label: string; action: string }>;
}

/** L3: Project phases overview */
export interface RoadmapData {
  phases: Array<{
    name: string;
    goal: string;
    status: "complete" | "current" | "pending";
  }>;
}

/** L3: Metabase dashboard metadata (D-08) */
export interface BiDashboardMetadataData {
  dashboardName: string;
  dashboardId?: number;
  cards: Array<{
    name: string;
    kpiName?: string;
    visualization: string;
  }>;
  metabaseUrl?: string;
}

// ---------------------------------------------------------------------------
// Action block data
// ---------------------------------------------------------------------------

/** Action: Plan approval with steps and SQL preview */
export interface PlanApprovalData {
  plan: {
    goal: string;
    steps: Array<{ description: string; sql?: string }>;
  };
  status: "proposed";
}

/** Action: Entity disambiguation with candidates */
export interface EntityDisambiguationData {
  mention: string;
  candidates: Array<{ name: string; type: string; context: string }>;
}

/** Action: Simple confirmation prompt */
export interface ConfirmationData {
  action_description: string;
  action_id: string;
}
