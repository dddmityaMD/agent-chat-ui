"use client";

import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Lightweight hook that checks whether any plugin has errors.
 * Used by SettingsButton to show an error indicator dot.
 */
export function usePluginStatus() {
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/plugins`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.has_errors) setHasErrors(true);
      })
      .catch(() => {}); // Silent fail — UI indicator should never block render
    return () => {
      cancelled = true;
    };
  }, []);

  return { hasErrors };
}
