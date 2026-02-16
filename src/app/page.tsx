"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { AuthProvider } from "@/providers/Auth";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import { LLMHealthProvider } from "@/providers/LLMHealth";
import { LLMRoutingEditor } from "@/components/llm-routing-editor";
import React from "react";

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      <AuthProvider>
        <ThreadProvider>
          <StreamProvider>
            <LLMHealthProvider>
              <ArtifactProvider>
                <LLMRoutingEditor />
                <Thread />
              </ArtifactProvider>
            </LLMHealthProvider>
          </StreamProvider>
        </ThreadProvider>
      </AuthProvider>
    </React.Suspense>
  );
}
