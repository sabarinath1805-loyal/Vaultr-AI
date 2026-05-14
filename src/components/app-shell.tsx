"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import useChatStore from "@/app/hooks/useChatStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const themePreference = useChatStore((state) => state.themePreference);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = themePreference === "dark" || (themePreference === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
  }, [themePreference]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
