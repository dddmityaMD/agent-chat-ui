"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

export function SettingsButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/settings")}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      title="Settings"
    >
      <Settings className="h-4 w-4 flex-shrink-0" />
    </button>
  );
}
