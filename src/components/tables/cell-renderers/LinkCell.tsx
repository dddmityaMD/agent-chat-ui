"use client";

import React from "react";
import type { ICellRendererParams } from "ag-grid-community";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LinkCellProps {
  value: string | { url: string; text: string } | null | undefined;
  external?: boolean;
  className?: string;
}

/**
 * Check if a URL is external (different origin)
 */
function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, window?.location?.origin || "http://localhost");
    return (
      typeof window !== "undefined" &&
      urlObj.origin !== window.location.origin
    );
  } catch {
    // If URL parsing fails, treat as external to be safe
    return true;
  }
}

/**
 * Extract hostname from a URL for display
 */
function getUrlHostname(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Return truncated URL if parsing fails
    return url.length > 30 ? url.slice(0, 30) + "..." : url;
  }
}

/**
 * LinkCell - Renders a clickable link with optional external indicator.
 *
 * Works with AG Grid ICellRendererParams or direct props.
 * - Accepts string URL or {url, text} object
 * - Shows ExternalLink icon for external URLs
 * - Opens in new tab when external
 * - Truncates long text with ellipsis
 */
export function LinkCell(
  params: ICellRendererParams | LinkCellProps,
): React.ReactElement | null {
  // Extract value from params
  const rawValue = "value" in params ? params.value : null;
  const className = "className" in params ? params.className : undefined;
  const forceExternal = "external" in params ? params.external : undefined;

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  // Parse value - can be string URL or {url, text} object
  let url: string;
  let text: string;

  if (typeof rawValue === "object" && "url" in rawValue) {
    url = rawValue.url;
    text = rawValue.text || getUrlHostname(rawValue.url);
  } else if (typeof rawValue === "string") {
    url = rawValue;
    text = getUrlHostname(rawValue);
  } else {
    return null;
  }

  const isExternal = forceExternal ?? isExternalUrl(url);
  const linkProps = isExternal
    ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};

  return (
    <a
      href={url}
      {...linkProps}
      className={cn(
        "text-primary inline-flex items-center gap-1 hover:underline max-w-full",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      title={url}
    >
      <span className="truncate">{text}</span>
      {isExternal && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
    </a>
  );
}

export default LinkCell;
