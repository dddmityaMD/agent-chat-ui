"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

export function SettingsButton() {
  const router = useRouter();
  const [hasPluginErrors, setHasPluginErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/plugins`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.has_errors) setHasPluginErrors(true);
      })
      .catch(() => {}); // Silent fail — settings button should always render
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <button
      onClick={() => router.push("/settings")}
      className="relative flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      title="Settings"
    >
      <Settings className="h-4 w-4 flex-shrink-0" />
      {hasPluginErrors && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </button>
  );
}
