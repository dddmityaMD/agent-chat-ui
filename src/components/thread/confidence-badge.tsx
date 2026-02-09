/**
 * Confidence badge component for agent responses.
 *
 * Extracts confidence level from structured sais_ui data (primary)
 * or response text (fallback) and renders a color-coded visual
 * indicator with natural language explanation.
 */

type ConfidenceLevel = "high" | "medium" | "low" | null;

interface ConfidenceData {
  level: "high" | "medium" | "low";
  reason?: string;
}

/**
 * Extract confidence from structured sais_ui data (PRIMARY)
 * or fall back to regex parsing of content (FALLBACK).
 *
 * Structured sais_ui.confidence is the contract -- emitted by
 * synthesis/answer nodes (Plans 04/05). Regex is defense-in-depth
 * for cases where structured data is missing.
 */
export function getConfidence(
  saisUiConfidence?: ConfidenceData | null,
  content?: string,
): ConfidenceLevel {
  // PRIMARY: structured sais_ui.confidence
  if (saisUiConfidence?.level) {
    const level = saisUiConfidence.level.toLowerCase();
    if (level === "high" || level === "medium" || level === "low") return level;
  }

  // FALLBACK: regex extraction from content
  if (content) {
    if (/\[?\*?\*?high confidence\*?\*?\]?/i.test(content)) return "high";
    if (/\[?\*?\*?medium confidence\*?\*?\]?/i.test(content)) return "medium";
    if (/\[?\*?\*?low confidence\*?\*?\]?/i.test(content)) return "low";
  }

  return null;
}

interface ConfidenceBadgeProps {
  content?: string;
  saisUiConfidence?: ConfidenceData | null;
}

export function ConfidenceBadge({ content, saisUiConfidence }: ConfidenceBadgeProps) {
  const level = getConfidence(saisUiConfidence, content);
  if (!level) return null;

  const config = {
    high: {
      label: "High Confidence",
      color: "bg-green-100 text-green-800 border-green-200",
      explanation: "Multiple evidence sources support this conclusion",
    },
    medium: {
      label: "Medium Confidence",
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      explanation: "Based on available evidence; some uncertainty remains",
    },
    low: {
      label: "Low Confidence",
      color: "bg-red-100 text-red-800 border-red-200",
      explanation: "Limited evidence; more investigation recommended",
    },
  };

  const reason = saisUiConfidence?.reason;
  const { label, color, explanation } = config[level];
  const tooltipText = reason || explanation;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}
      title={tooltipText}
      data-testid="confidence-badge"
      data-confidence-level={level}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </div>
  );
}
