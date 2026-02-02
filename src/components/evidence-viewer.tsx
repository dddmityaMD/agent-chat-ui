"use client";

import React, { useState } from "react";
import { MarkdownText } from "@/components/thread/markdown-text";
import { ChevronDownIcon, ChevronRightIcon, DatabaseIcon, GitBranchIcon, FileCodeIcon, GlobeIcon, BarChart2, Layers, ExternalLink } from "lucide-react";
import { generateDeepLinkUrl, DeepLinkType } from "@/lib/deep-links";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DeduplicationIndicator, isDebugMode } from "@/components/evidence/DeduplicationIndicator";

export interface EvidenceItem {
  evidence_id?: string;
  type: string;
  title?: string;
  payload?: {
    query?: string;
    rows?: any[];
    columns?: string[];
    diff?: string;
    commit?: string;
    manifest_summary?: any;
    run_summary?: any;
    file_path?: string;
    response?: any;
    card_id?: number;
    [key: string]: any;
  };
  created_at?: string;
  // Deduplication fields (EVID-04)
  is_duplicate?: boolean;
  content_hash?: string;
}

interface EvidenceViewerProps {
  evidence: EvidenceItem;
  defaultExpanded?: boolean;
}

function getEvidenceIcon(type: string) {
  switch (type) {
    case "SQL_QUERY_RESULT":
      return <DatabaseIcon className="h-4 w-4 text-blue-600" />;
    case "GIT_DIFF":
      return <GitBranchIcon className="h-4 w-4 text-orange-600" />;
    case "DBT_ARTIFACT":
      return <FileCodeIcon className="h-4 w-4 text-green-600" />;
    case "API_RESPONSE":
      return <GlobeIcon className="h-4 w-4 text-purple-600" />;
    default:
      return <FileCodeIcon className="h-4 w-4 text-gray-600" />;
  }
}

/**
 * Extract deep link information from evidence item.
 * Parses evidence.type and evidence.payload to determine the appropriate link type.
 */
function getDeepLinkInfo(evidence: EvidenceItem): { type: DeepLinkType; id: string | number; url: string } | null {
  const payload = evidence.payload;

  // API_RESPONSE with card_id -> Metabase card
  if (evidence.type === "API_RESPONSE" && payload?.card_id) {
    const url = generateDeepLinkUrl("metabase_card", String(payload.card_id));
    return url ? { type: "metabase_card", id: payload.card_id, url } : null;
  }

  // GIT_DIFF with commit -> Git commit
  if (evidence.type === "GIT_DIFF" && payload?.commit) {
    const url = generateDeepLinkUrl("git_commit", payload.commit);
    return url ? { type: "git_commit", id: payload.commit, url } : null;
  }

  // DBT_ARTIFACT with model_name -> dbt model docs
  if (evidence.type === "DBT_ARTIFACT" && payload?.model_name) {
    const url = generateDeepLinkUrl("dbt_model", payload.model_name);
    return url ? { type: "dbt_model", id: payload.model_name, url } : null;
  }

  return null;
}

/**
 * Get the appropriate icon component for a deep link type.
 */
function getDeepLinkIcon(type: DeepLinkType) {
  switch (type) {
    case "metabase_card":
    case "metabase_dashboard":
      return <BarChart2 className="h-3.5 w-3.5" />;
    case "git_commit":
    case "git_file":
      return <GitBranchIcon className="h-3.5 w-3.5" />;
    case "dbt_model":
    case "dbt_source":
    case "dbt_test":
    case "dbt_docs":
      return <Layers className="h-3.5 w-3.5" />;
    default:
      return <ExternalLink className="h-3.5 w-3.5" />;
  }
}

/**
 * Get human-readable label for deep link type (for tooltip display).
 */
function getDeepLinkLabel(type: DeepLinkType): string {
  switch (type) {
    case "metabase_card":
      return "Metabase Card";
    case "metabase_dashboard":
      return "Metabase Dashboard";
    case "git_commit":
      return "Git Commit";
    case "git_file":
      return "Git File";
    case "dbt_model":
      return "dbt Model";
    case "dbt_source":
      return "dbt Source";
    case "dbt_test":
      return "dbt Test";
    case "dbt_docs":
      return "dbt Docs";
    default:
      return "Source";
  }
}

function formatSqlResult(payload: EvidenceItem["payload"]): string {
  if (!payload?.rows?.length) return "*No data returned*";

  const rows = payload.rows.slice(0, 10);
  const columns = payload.columns || Object.keys(rows[0] || {});

  // Build markdown table
  let md = "| " + columns.join(" | ") + " |\n";
  md += "| " + columns.map(() => "---").join(" | ") + " |\n";
  for (const row of rows) {
    md += "| " + columns.map((c) => String(row[c] ?? "")).join(" | ") + " |\n";
  }

  if (payload.rows.length > 10) {
    md += `\n*... and ${payload.rows.length - 10} more rows*`;
  }

  return md;
}

function formatGitDiff(payload: EvidenceItem["payload"]): string {
  if (!payload?.diff) return "*No diff available*";

  const diff = payload.diff.slice(0, 5000);
  return "```diff\n" + diff + (payload.diff.length > 5000 ? "\n... truncated" : "") + "\n```";
}

function formatDbtArtifact(payload: EvidenceItem["payload"]): string {
  if (!payload?.manifest_summary && !payload?.run_summary && !payload?.file_path) {
    return "*No dbt data or run results*";
  }

  let md = "";
  if (payload.file_path) {
    md += `**File:** \`${payload.file_path}\`\n\n`;
  }
  if (payload.manifest_summary) {
    md += "**Manifest Summary:**\n";
    const summary = typeof payload.manifest_summary === "string"
      ? payload.manifest_summary
      : JSON.stringify(payload.manifest_summary, null, 2);
    md += "```json\n" + summary.slice(0, 3000) + "\n```\n";
  }
  if (payload.run_summary) {
    md += "**Run Results:**\n";
    const summary = typeof payload.run_summary === "string"
      ? payload.run_summary
      : JSON.stringify(payload.run_summary, null, 2);
    md += "```json\n" + summary.slice(0, 3000) + "\n```";
  }
  return md;
}

function formatApiResponse(payload: EvidenceItem["payload"]): string {
  if (!payload?.response) return "*No API response*";

  const response = typeof payload.response === "string"
    ? payload.response
    : JSON.stringify(payload.response, null, 2);
  return "```json\n" + response.slice(0, 3000) + "\n```";
}

function formatGenericPayload(payload: EvidenceItem["payload"]): string {
  if (!payload) return "*No payload data*";
  return "```json\n" + JSON.stringify(payload, null, 2).slice(0, 3000) + "\n```";
}

export function EvidenceViewer({ evidence, defaultExpanded = false }: EvidenceViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const deepLink = getDeepLinkInfo(evidence);

  const renderPayload = () => {
    if (!evidence.payload) {
      return <div className="text-sm text-muted-foreground">No payload data</div>;
    }

    switch (evidence.type) {
      case "SQL_QUERY_RESULT":
        return (
          <div className="space-y-3">
            {evidence.payload.query && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Query:</div>
                <MarkdownText>{"```sql\n" + evidence.payload.query + "\n```"}</MarkdownText>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Results:</div>
              <MarkdownText>{formatSqlResult(evidence.payload)}</MarkdownText>
            </div>
          </div>
        );

      case "GIT_DIFF":
        return (
          <div className="space-y-2">
            {evidence.payload.commit && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Commit:</span> {evidence.payload.commit}
              </div>
            )}
            {evidence.payload.file_path && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">File:</span> {evidence.payload.file_path}
              </div>
            )}
            <MarkdownText>{formatGitDiff(evidence.payload)}</MarkdownText>
          </div>
        );

      case "DBT_ARTIFACT":
        return <MarkdownText>{formatDbtArtifact(evidence.payload)}</MarkdownText>;

      case "API_RESPONSE":
        return <MarkdownText>{formatApiResponse(evidence.payload)}</MarkdownText>;

      default:
        return <MarkdownText>{formatGenericPayload(evidence.payload)}</MarkdownText>;
    }
  };

  return (
    <div className="border rounded-md bg-white overflow-hidden">
      <div className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
        {/* Expand/collapse button */}
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          {getEvidenceIcon(evidence.type)}
          <span className="font-medium text-sm flex-1 truncate">
            {evidence.title || evidence.type}
          </span>
          {evidence.is_duplicate && (
            <DeduplicationIndicator
              isDuplicate={evidence.is_duplicate}
              contentHash={evidence.content_hash}
              showHash={isDebugMode()}
              className="ml-1"
            />
          )}
        </button>

        {/* Deep link icon with tooltip */}
        {deepLink && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={deepLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                data-testid="deep-link-icon"
              >
                {getDeepLinkIcon(deepLink.type)}
              </a>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs font-medium">Open in {getDeepLinkLabel(deepLink.type)}</p>
              <p className="text-xs opacity-80 truncate max-w-xs">{deepLink.url}</p>
            </TooltipContent>
          </Tooltip>
        )}

        <span className="text-xs text-muted-foreground flex-shrink-0">{evidence.type}</span>
      </div>

      {expanded && (
        <div className="border-t p-3 bg-gray-50 overflow-x-auto max-h-[400px] overflow-y-auto">
          {renderPayload()}
        </div>
      )}
    </div>
  );
}

// Component to show linked evidence from IDs
interface LinkedEvidenceProps {
  evidenceIds?: string[];
  allEvidence: EvidenceItem[];
  defaultExpanded?: boolean;
}

export function LinkedEvidence({ evidenceIds, allEvidence, defaultExpanded = false }: LinkedEvidenceProps) {
  if (!evidenceIds?.length) return null;

  const linkedItems = allEvidence.filter((e) =>
    e.evidence_id && evidenceIds.includes(e.evidence_id)
  );

  if (!linkedItems.length) {
    // Show IDs even if we can't find the evidence
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Evidence refs: {evidenceIds.map((id) => id.slice(0, 8)).join(", ")}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Supporting Evidence:</div>
      {linkedItems.map((e) => (
        <EvidenceViewer
          key={e.evidence_id || Math.random().toString()}
          evidence={e}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
}
