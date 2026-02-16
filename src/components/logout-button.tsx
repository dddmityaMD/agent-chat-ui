"use client";

import { useAuth } from "@/providers/Auth";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const { logout, username } = useAuth();
  return (
    <button
      onClick={logout}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      title="Sign out"
    >
      {username && (
        <span className="max-w-[120px] truncate">{username}</span>
      )}
      <LogOut className="h-4 w-4 flex-shrink-0" />
    </button>
  );
}
