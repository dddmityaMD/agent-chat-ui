"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import { CasesProvider } from "@/providers/Cases";
import { LLMHealthProvider } from "@/providers/LLMHealth";
import { LLMRoutingEditor } from "@/components/llm-routing-editor";
import { ContextPanelBridge } from "@/components/context-panel/bridge";
import React from "react";

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      <CasesProvider>
        <ThreadProvider>
          <StreamProvider>
            <LLMHealthProvider>
              <ArtifactProvider>
                <LLMRoutingEditor />
                <Thread />
                <ContextPanelBridge />
              </ArtifactProvider>
            </LLMHealthProvider>
          </StreamProvider>
        </ThreadProvider>
      </CasesProvider>
    </React.Suspense>
  );
}
