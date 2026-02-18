import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { AuthProvider } from "@/providers/Auth";
import React from "react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex h-screen">
        <SettingsSidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
