"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, Download } from "lucide-react";

export interface LoadMoreButtonProps {
  hasMore: boolean;
  loading: boolean;
  loadedCount: number;
  totalCount?: number;
  onLoadMore: () => void;
  batchSize?: number;
  showLoadAll?: boolean;
  onLoadAll?: () => void;
  className?: string;
}

export function LoadMoreButton({
  hasMore,
  loading,
  loadedCount,
  totalCount,
  onLoadMore,
  batchSize = 10,
  showLoadAll = false,
  onLoadAll,
  className,
}: LoadMoreButtonProps) {
  // Complete state: no more results to load
  if (!hasMore && !loading) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center py-3 text-sm",
          className,
        )}
      >
        <span>
          Showing all {loadedCount} result{loadedCount !== 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  // Progress text calculation
  const progressText = totalCount
    ? `Showing ${loadedCount} of ${totalCount} results`
    : `Showing ${loadedCount} results`;

  const remainingCount = totalCount ? totalCount - loadedCount : undefined;
  const nextBatchSize = remainingCount
    ? Math.min(batchSize, remainingCount)
    : batchSize;

  return (
    <div
      className={cn(
        "bg-muted/30 flex flex-col items-center gap-3 border-t py-4",
        className,
      )}
    >
      {/* Progress indicator */}
      <div className="text-muted-foreground text-sm">{progressText}</div>

      {/* Progress bar if total is known */}
      {totalCount && totalCount > 0 && (
        <div className="bg-muted h-2 w-full max-w-xs overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min((loadedCount / totalCount) * 100, 100)}%`,
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Load More Button */}
        <Button
          variant="outline"
          size="default"
          onClick={onLoadMore}
          disabled={loading || !hasMore}
          aria-label={`Load ${nextBatchSize} more results`}
          className="min-w-[140px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              <span>Load {nextBatchSize} more</span>
            </>
          )}
        </Button>

        {/* Load All Button (optional) */}
        {showLoadAll &&
          onLoadAll &&
          hasMore &&
          !loading &&
          remainingCount &&
          remainingCount <= 50 && (
            <Button
              variant="ghost"
              size="default"
              onClick={onLoadAll}
              aria-label="Load all remaining results"
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Load all ({remainingCount})</span>
            </Button>
          )}
      </div>

      {/* Keyboard hint */}
      <div className="text-muted-foreground/60 text-xs">
        Press Enter or Space to load more
      </div>
    </div>
  );
}

// Alternative compact version for inline use
export function LoadMoreButtonCompact({
  hasMore,
  loading,
  loadedCount,
  totalCount,
  onLoadMore,
  className,
}: Omit<LoadMoreButtonProps, "batchSize" | "showLoadAll" | "onLoadAll">) {
  if (!hasMore && !loading) {
    return (
      <span className={cn("text-muted-foreground text-xs", className)}>
        {loadedCount} total
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onLoadMore}
      disabled={loading || !hasMore}
      aria-label="Load more results"
      className={cn("h-7 px-2 text-xs", className)}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <ChevronDown className="mr-1 h-3 w-3" />
          <span>Load more</span>
          {totalCount && (
            <span className="text-muted-foreground ml-1">
              ({loadedCount}/{totalCount})
            </span>
          )}
        </>
      )}
    </Button>
  );
}

export default LoadMoreButton;
