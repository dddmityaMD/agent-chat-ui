"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownText } from "@/components/thread/markdown-text";
import { PaginatedEvidenceTable } from "@/components/tables/PaginatedEvidenceTable";
import {
  createTableColumnDefs,
  createColumnColumnDefs,
  createReportColumnDefs,
  createDashboardColumnDefs,
  createDbtModelColumnDefs,
  createGitCommitColumnDefs,
} from "@/components/tables/columnDefinitions";
import { cn } from "@/lib/utils";
import {
  Loader2,
  AlertCircle,
  Database,
  FileSearch,
  Lightbulb,
} from "lucide-react";
import type { ColDef } from "ag-grid-community";
import type { EvidenceItem } from "@/hooks/useQueryStreaming";

export type EntityType =
  | "table"
  | "column"
  | "report"
  | "dashboard"
  | "dbt_model"
  | "git_commit"
  | "mixed";

export interface QueryResultsProps {
  evidence: EvidenceItem[];
  answer?: string;
  isLoading: boolean;
  /** @deprecated Pagination is now handled internally by PaginatedEvidenceTable */
  hasMore?: boolean;
  /** @deprecated Use onPageChange for pagination events */
  onLoadMore?: () => void;
  entityType: EntityType;
  /** @deprecated Use evidence.length */
  loadedCount?: number;
  totalCount?: number;
  className?: string;
  error?: Error;
  /** Callback when page changes in paginated table */
  onPageChange?: (page: number) => void;
}

function getColumnDefsForEntityType(entityType: EntityType): ColDef[] {
  switch (entityType) {
    case "table":
      return createTableColumnDefs();
    case "column":
      return createColumnColumnDefs();
    case "report":
      return createReportColumnDefs();
    case "dashboard":
      return createDashboardColumnDefs();
    case "dbt_model":
      return createDbtModelColumnDefs();
    case "git_commit":
      return createGitCommitColumnDefs();
    case "mixed":
    default:
      // Generic columns for mixed entity types
      return [
        {
          field: "entity_type",
          headerName: "Type",
          width: 100,
        },
        {
          field: "name",
          headerName: "Name",
          width: 200,
        },
        {
          field: "description",
          headerName: "Description",
          width: 200,
          flex: 1,
        },
        {
          field: "source",
          headerName: "Source",
          width: 120,
        },
      ];
  }
}

function AnswerSection({
  answer,
  isLoading,
}: {
  answer?: string;
  isLoading: boolean;
}) {
  if (!answer && !isLoading) return null;

  return (
    <Card className="border-l-primary mb-4 border-l-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="text-primary h-4 w-4" />
          Answer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !answer ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Synthesizing answer...</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <MarkdownText>{answer || ""}</MarkdownText>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasFilters = false }: { hasFilters?: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted mb-4 rounded-full p-4">
          <FileSearch className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-medium">No results found</h3>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          {hasFilters
            ? "Try adjusting your filters or search criteria to find what you're looking for."
            : "Your query didn't return any results. Try rephrasing or checking your search terms."}
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error?: Error }) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center py-8">
        <div className="bg-destructive/10 mb-4 rounded-full p-4">
          <AlertCircle className="text-destructive h-8 w-8" />
        </div>
        <h3 className="text-destructive mb-2 text-lg font-medium">
          Query Error
        </h3>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          {error?.message ||
            "An error occurred while processing your query. Please try again."}
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
        <h3 className="mb-2 text-lg font-medium">Loading results...</h3>
        <p className="text-muted-foreground text-sm">
          Collecting evidence from connected sources
        </p>
      </CardContent>
    </Card>
  );
}

export function QueryResults({
  evidence,
  answer,
  isLoading,
  hasMore: _hasMore,
  onLoadMore: _onLoadMore,
  entityType,
  loadedCount: _loadedCount,
  totalCount,
  className,
  error,
  onPageChange,
}: QueryResultsProps) {
  // Get appropriate column definitions
  const columnDefs = useMemo(
    () => getColumnDefsForEntityType(entityType),
    [entityType],
  );

  // Transform evidence to row data
  const rowData = useMemo(() => {
    return evidence.map((item) => ({
      ...item,
      id: item.id || `evidence_${Math.random().toString(36).slice(2, 11)}`,
    }));
  }, [evidence]);

  // Use evidence length for count display
  const actualTotalCount = totalCount ?? evidence.length;

  // Handle error state
  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <AnswerSection
          answer={answer}
          isLoading={isLoading}
        />
        <ErrorState error={error} />
      </div>
    );
  }

  // Handle initial loading state
  if (isLoading && evidence.length === 0 && !answer) {
    return (
      <div className={cn("space-y-4", className)}>
        <LoadingState />
      </div>
    );
  }

  // Handle empty state
  if (!isLoading && evidence.length === 0 && !answer) {
    return (
      <div className={cn("space-y-4", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Answer Section */}
      <AnswerSection
        answer={answer}
        isLoading={isLoading}
      />

      {/* Evidence Table */}
      {evidence.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Database className="text-muted-foreground h-4 w-4" />
              Evidence
              <span className="text-muted-foreground text-xs font-normal">
                ({actualTotalCount} total)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PaginatedEvidenceTable
              rowData={rowData}
              columnDefs={columnDefs}
              loading={isLoading && evidence.length > 0}
              totalCount={actualTotalCount}
              height={400}
              emptyMessage="No evidence matches your filters"
              onPageChange={onPageChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QueryResults;
