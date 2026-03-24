"use client";

import React, { useCallback, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { MarkdownText } from "@/components/thread/markdown-text";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CodeRendererProps {
  /**
   * Expected shape: { code: string; language: 'sql' | 'yaml' | 'markdown' }
   */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

interface CodeData {
  code: string;
  language: string;
}

function isCodeData(v: unknown): v is CodeData {
  return (
    v != null &&
    typeof v === "object" &&
    "code" in v &&
    typeof (v as CodeData).code === "string"
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeRenderer({ data }: CodeRendererProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!isCodeData(data)) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — ignore silently
    }
  }, [data]);

  if (!isCodeData(data) || !data.code) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No code to display
      </div>
    );
  }

  const isMarkdown =
    data.language === "markdown" || data.language === "md";

  // Markdown files: render as formatted markdown instead of syntax-highlighted source
  if (isMarkdown) {
    return (
      <div className="relative h-full overflow-auto" data-testid="code-renderer">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-3 top-3 z-10 rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1.5 text-zinc-500 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
          aria-label={copied ? "Copied" : "Copy source"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
          <MarkdownText>{data.code}</MarkdownText>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto" data-testid="code-renderer">
      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 z-10 rounded border border-zinc-600 bg-zinc-800 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-700"
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>

      <SyntaxHighlighter
        language={data.language || "sql"}
        style={oneDark}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          minHeight: "100%",
          fontSize: "0.875rem",
        }}
      >
        {data.code}
      </SyntaxHighlighter>
    </div>
  );
}
