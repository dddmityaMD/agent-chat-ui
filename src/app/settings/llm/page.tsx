"use client";

import { LLMRoutingEditor } from "@/components/llm-routing-editor";

export default function LLMConfigPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-4">
        LLM Configuration
      </h1>
      <LLMRoutingEditor />
    </div>
  );
}
