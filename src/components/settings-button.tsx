"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { usePluginStatus } from "@/hooks/usePluginStatus";

export function SettingsButton() {
  const router = useRouter();
  const { hasErrors: hasPluginErrors } = usePluginStatus();

  return (
    <button
      onClick={() => router.push("/settings")}
      className="relative flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      aria-label={hasPluginErrors ? "Settings (plugin errors detected)" : "Settings"}
    >
      <Settings className="h-4 w-4 flex-shrink-0" />
      {hasPluginErrors && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive"
        />
      )}
    </button>
  );
}
