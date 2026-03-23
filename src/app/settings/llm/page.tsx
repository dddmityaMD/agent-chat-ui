"use client";

import { LLMRoutingEditor } from "@/components/llm-routing-editor";
import { EmbeddingConfigSection } from "@/components/embedding-config";

export default function LLMConfigPage() {
  return (
    <div>
      <h1 className="text-foreground mb-4 text-xl font-semibold">
        LLM Configuration
      </h1>
      <LLMRoutingEditor />
      <EmbeddingConfigSection />
    </div>
  );
}
