"use client";

import React from "react";

interface CostTabProps {
  threadId?: string;
}

export function CostTab({ threadId }: CostTabProps) {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      <p>Cost tracking data will appear here after sending messages.</p>
    </div>
  );
}
