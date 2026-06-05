"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import useChatStore from "@/app/hooks/useChatStore";
import { OnboardingModal, hasCompletedOnboarding } from "@/components/onboarding/onboarding-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const themePreference = useChatStore((state) => state.themePreference);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = themePreference === "dark" || (themePreference === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
    root.classList.toggle("dark", dark);
  }, [themePreference]);

  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
