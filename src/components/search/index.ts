/**
 * Search transparency components for SAIS DataBI.
 *
 * These components display why search results matched, providing
 * transparency into the search/evidence collection process.
 */

export {
  MatchReasonDisplay,
  highlightTerms,
  formatFieldName,
  getConfidenceColor,
} from "./MatchReasonDisplay";
export type { MatchReason, MatchReasonDisplayProps } from "./MatchReasonDisplay";

export { SearchTransparencyPanel } from "./SearchTransparencyPanel";
export type { SearchTransparencyPanelProps } from "./SearchTransparencyPanel";
