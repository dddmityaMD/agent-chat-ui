"use client";

import type { PermissionGrant } from "@/lib/types";

interface PermissionPillProps {
  grants: PermissionGrant[];
  onClick?: () => void;
}

function getScopeLabel(scope: string): string {
  if (scope === "1h") return "1h";
  if (scope === "session") return "session";
  if (scope === "once") return "once pending";
  return scope;
}

export function PermissionPill({ grants, onClick }: PermissionPillProps) {
  if (grants.length === 0) return null;
  const [latestGrant] = grants;
  const capability = latestGrant.capability?.toUpperCase() || "WRITE";
  const label = `${capability} ${getScopeLabel(latestGrant.scope)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
      data-testid="permission-pill"
    >
      {label}
    </button>
  );
}

export default PermissionPill;
