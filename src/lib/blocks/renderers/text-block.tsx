"use client";

import type { BlockRendererProps } from "../types";
import type { TextBlockData } from "../types";
import { MarkdownText } from "@/components/thread/markdown-text";

export function TextBlock({ block }: BlockRendererProps) {
  const data = block as TextBlockData;

  if (!data.content) {
    return null;
  }

  return <MarkdownText>{data.content}</MarkdownText>;
}
