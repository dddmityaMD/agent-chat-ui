/**
 * Readiness components for displaying connector health status
 *
 * @module readiness
 */
export { ReadinessPanel } from "./ReadinessPanel";
export type { ReadinessPanelProps } from "./ReadinessPanel";

export { ConnectorStatusCard } from "./ConnectorStatusCard";
export type { ConnectorStatusCardProps } from "./ConnectorStatusCard";

// Re-export hooks for convenience
export {
  useConnectorStatus,
  useReadinessPolling,
  useParallelExecution,
  getStatusColor,
  getStatusColorClass,
  getStatusTextClass,
  formatLastFetch,
  type ConnectorStatus,
  type ReadinessStatus,
  type ReadinessResponse,
  type ParallelExecutionJob,
} from "@/hooks/useConnectorStatus";
