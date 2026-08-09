"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import useChatStore from "@/app/hooks/useChatStore";
import { OnboardingModal, hasCompletedOnboarding } from "@/components/onboarding/onboarding-modal";
import { safeStorage } from "@/lib/safe-storage";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const themePreference = useChatStore((state) => state.themePreference);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSidebarOpenDesktop, setIsSidebarOpenDesktop] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = themePreference === "dark" || (themePreference === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
    root.classList.toggle("dark", dark);
  }, [themePreference]);

  useEffect(() => {
    if (!hasCompletedOnboarding()) setShowOnboarding(true);

    const saved = safeStorage.getItem("vaultr-sidebar-open");
    const desktopOpen = saved === null ? true : saved === "true";
    setIsSidebarOpenDesktop(desktopOpen);
    setIsSidebarOpen(window.innerWidth >= 768 ? desktopOpen : false);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(isSidebarOpenDesktop);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isSidebarOpenDesktop]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-current-w",
      isSidebarOpen ? "var(--sidebar-w)" : "var(--sidebar-collapsed-w)",
    );
  }, [isSidebarOpen]);

  const toggleSidebar = useCallback(() => {
    const desktop = window.innerWidth >= 768;
    if (desktop) {
      const next = !isSidebarOpenDesktop;
      setIsSidebarOpenDesktop(next);
      setIsSidebarOpen(next);
      safeStorage.setItem("vaultr-sidebar-open", String(next));
    } else {
      setIsSidebarOpen((value) => !value);
    }
  }, [isSidebarOpenDesktop]);

  return (
    <div className="h-dvh bg-[var(--bg)] text-[var(--text)]">
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <div className="flex h-full min-w-0 overflow-visible">
        <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

        <div className="relative flex h-dvh min-w-0 flex-1 flex-col md:overflow-hidden">
          <div className="relative z-20 flex shrink-0 items-center px-4 pb-2 pt-3 md:hidden">
            <button
              type="button"
              onClick={toggleSidebar}
              className="vaultr-liquid flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-all active:scale-95"
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
          <main
            data-route={pathname}
            className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto md:overflow-hidden"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
