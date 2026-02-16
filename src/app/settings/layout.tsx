import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import React from "react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <SettingsSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
