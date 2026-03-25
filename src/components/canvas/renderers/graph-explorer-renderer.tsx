"use client";

import dynamic from "next/dynamic";

/**
 * SSR-safe wrapper for the Sigma.js graph explorer.
 *
 * Sigma uses WebGL which requires `window` and `document` — dynamic import
 * with ssr:false prevents NextJS from attempting server-side rendering.
 */
const GraphExplorerInnerDynamic = dynamic(
  () =>
    import("./graph-explorer-inner").then((m) => ({
      default: m.GraphExplorerInner,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading graph explorer...
      </div>
    ),
  },
);

interface GraphExplorerRendererProps {
  data?: unknown;
  className?: string;
}

export function GraphExplorerRenderer({ className }: GraphExplorerRendererProps) {
  return (
    <div className="h-full w-full" data-testid="graph-explorer-renderer">
      <GraphExplorerInnerDynamic className={className} />
    </div>
  );
}
