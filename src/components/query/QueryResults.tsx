"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownText } from "@/components/thread/markdown-text";
import { EvidenceTable } from "@/components/tables/EvidenceTable";
import { LoadMoreButton } from "@/components/tables/LoadMoreButton";
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
  hasMore: boolean;
  onLoadMore: () => void;
  entityType: EntityType;
  loadedCount: number;
  totalCount?: number;
  className?: string;
  error?: Error;
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
          width: 120,
        },
        {
          field: "name",
          headerName: "Name",
          width: 250,
        },
        {
          field: "description",
          headerName: "Description",
          width: 400,
        },
        {
          field: "source",
          headerName: "Source",
          width: 150,
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
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Answer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !answer ? (
          <div className="flex items-center gap-2 text-muted-foreground">
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

function EmptyState({
  hasFilters = false,
}: {
  hasFilters?: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileSearch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
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
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-destructive">
          Query Error
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
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
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-medium mb-2">Loading results...</h3>
        <p className="text-sm text-muted-foreground">
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
  hasMore,
  onLoadMore,
  entityType,
  loadedCount,
  totalCount,
  className,
  error,
}: QueryResultsProps) {
  // Get appropriate column definitions
  const columnDefs = useMemo(
    () => getColumnDefsForEntityType(entityType),
    [entityType]
  );

  // Transform evidence to row data
  const rowData = useMemo(() => {
    return evidence.map((item) => ({
      ...item,
      id: item.id || `evidence_${Math.random().toString(36).slice(2, 11)}`,
    }));
  }, [evidence]);

  // Handle error state
  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <AnswerSection answer={answer} isLoading={isLoading} />
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
      <AnswerSection answer={answer} isLoading={isLoading} />

      {/* Evidence Table */}
      {evidence.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Evidence
              {totalCount !== undefined && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({loadedCount} of {totalCount})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <EvidenceTable
              rowData={rowData}
              columnDefs={columnDefs}
              loading={isLoading && evidence.length > 0}
              height={400}
              emptyMessage="No evidence matches your filters"
            />

            {/* Load More Button */}
            {(hasMore || isLoading) && (
              <LoadMoreButton
                hasMore={hasMore}
                loading={isLoading}
                loadedCount={loadedCount}
                totalCount={totalCount}
                onLoadMore={onLoadMore}
                batchSize={10}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QueryResults;
