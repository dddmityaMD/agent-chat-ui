"use client";

const STARTER_QUERIES = [
  "What tables do we have in the data warehouse?",
  "Show me the lineage for our key metrics",
  "Are there any data quality issues to investigate?",
];

interface EmptyStateProps {
  onSelect: (query: string) => void;
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      <h2 className="text-lg font-medium text-foreground">
        What would you like to know about your data?
      </h2>
      <p className="text-sm text-muted-foreground">
        Ask about your data sources, lineage, quality, or start an
        investigation.
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {STARTER_QUERIES.map((query) => (
          <button
            key={query}
            type="button"
            onClick={() => onSelect(query)}
            className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-accent"
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
