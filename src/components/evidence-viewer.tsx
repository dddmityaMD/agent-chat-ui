"use client";

import React, { useState } from "react";
import { MarkdownText } from "@/components/thread/markdown-text";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  GitBranchIcon,
  FileCodeIcon,
  GlobeIcon,
} from "lucide-react";
import {
  detectDeepLink,
  getDeepLinkIcon,
  getDeepLinkLabel,
} from "@/lib/deep-links";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DeduplicationIndicator,
  isDebugMode,
} from "@/components/evidence/DeduplicationIndicator";

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
  return (
    "```diff\n" +
    diff +
    (payload.diff.length > 5000 ? "\n... truncated" : "") +
    "\n```"
  );
}

function formatDbtArtifact(payload: EvidenceItem["payload"]): string {
  if (
    !payload?.manifest_summary &&
    !payload?.run_summary &&
    !payload?.file_path
  ) {
    return "*No dbt data or run results*";
  }

  let md = "";
  if (payload.file_path) {
    md += `**File:** \`${payload.file_path}\`\n\n`;
  }
  if (payload.manifest_summary) {
    md += "**Manifest Summary:**\n";
    const summary =
      typeof payload.manifest_summary === "string"
        ? payload.manifest_summary
        : JSON.stringify(payload.manifest_summary, null, 2);
    md += "```json\n" + summary.slice(0, 3000) + "\n```\n";
  }
  if (payload.run_summary) {
    md += "**Run Results:**\n";
    const summary =
      typeof payload.run_summary === "string"
        ? payload.run_summary
        : JSON.stringify(payload.run_summary, null, 2);
    md += "```json\n" + summary.slice(0, 3000) + "\n```";
  }
  return md;
}

function formatApiResponse(payload: EvidenceItem["payload"]): string {
  if (!payload?.response) return "*No API response*";

  const response =
    typeof payload.response === "string"
      ? payload.response
      : JSON.stringify(payload.response, null, 2);
  return "```json\n" + response.slice(0, 3000) + "\n```";
}

function formatGenericPayload(payload: EvidenceItem["payload"]): string {
  if (!payload) return "*No payload data*";
  return (
    "```json\n" + JSON.stringify(payload, null, 2).slice(0, 3000) + "\n```"
  );
}

export function EvidenceViewer({
  evidence,
  defaultExpanded = false,
}: EvidenceViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const deepLink = detectDeepLink(evidence);

  const renderPayload = () => {
    if (!evidence.payload) {
      return (
        <div className="text-muted-foreground text-sm">No payload data</div>
      );
    }

    switch (evidence.type) {
      case "SQL_QUERY_RESULT":
        return (
          <div className="space-y-3">
            {evidence.payload.query && (
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium">
                  Query:
                </div>
                <MarkdownText>
                  {"```sql\n" + evidence.payload.query + "\n```"}
                </MarkdownText>
              </div>
            )}
            <div>
              <div className="text-muted-foreground mb-1 text-xs font-medium">
                Results:
              </div>
              <MarkdownText>{formatSqlResult(evidence.payload)}</MarkdownText>
            </div>
          </div>
        );

      case "GIT_DIFF":
        return (
          <div className="space-y-2">
            {evidence.payload.commit && (
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">Commit:</span>{" "}
                {evidence.payload.commit}
              </div>
            )}
            {evidence.payload.file_path && (
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">File:</span>{" "}
                {evidence.payload.file_path}
              </div>
            )}
            <MarkdownText>{formatGitDiff(evidence.payload)}</MarkdownText>
          </div>
        );

      case "DBT_ARTIFACT":
        return (
          <MarkdownText>{formatDbtArtifact(evidence.payload)}</MarkdownText>
        );

      case "API_RESPONSE":
        return (
          <MarkdownText>{formatApiResponse(evidence.payload)}</MarkdownText>
        );

      default:
        return (
          <MarkdownText>{formatGenericPayload(evidence.payload)}</MarkdownText>
        );
    }
  };

  return (
    <div className="bg-card overflow-hidden rounded-md border">
      <div className="hover:bg-muted flex w-full items-center gap-2 p-3 transition-colors">
        {/* Expand/collapse button */}
        <button
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${evidence.title || evidence.type}`}
        >
          {expanded ? (
            <ChevronDownIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          )}
          {getEvidenceIcon(evidence.type)}
          <span className="flex-1 truncate text-sm font-medium">
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
                className="flex-shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                onClick={(e) => e.stopPropagation()}
                data-testid="deep-link-icon"
              >
                {React.createElement(getDeepLinkIcon(deepLink.type), { className: "h-3.5 w-3.5" })}
              </a>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs font-medium">
                Open in {getDeepLinkLabel(deepLink.type)}
              </p>
              <p className="max-w-xs truncate text-xs opacity-80">
                {deepLink.url}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        <span className="text-muted-foreground flex-shrink-0 text-xs">
          {evidence.type}
        </span>
      </div>

      {expanded && (
        <div className="bg-muted max-h-[400px] overflow-x-auto overflow-y-auto border-t p-3">
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

export function LinkedEvidence({
  evidenceIds,
  allEvidence,
  defaultExpanded = false,
}: LinkedEvidenceProps) {
  if (!evidenceIds?.length) return null;

  const linkedItems = allEvidence.filter(
    (e) => e.evidence_id && evidenceIds.includes(e.evidence_id),
  );

  if (!linkedItems.length) {
    // Show IDs even if we can't find the evidence
    return (
      <div className="text-muted-foreground mt-1 text-xs">
        Evidence refs: {evidenceIds.map((id) => id.slice(0, 8)).join(", ")}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="text-muted-foreground text-xs font-medium">
        Supporting Evidence:
      </div>
      {linkedItems.map((e, idx) => (
        <EvidenceViewer
          key={e.evidence_id || `linked-${idx}`}
          evidence={e}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
}
