"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { safeStorage } from "@/lib/safe-storage";
import {
  IconBriefcase,
  IconChevronLeft,
  IconChevronRight,
  IconFileSearch,
  IconFolder,
  IconHistory,
  IconMessage2,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import useChatStore from "@/app/hooks/useChatStore";

const primaryItems = [
  { href: "/", label: "Lex", icon: IconMessage2 },
  { href: "/matters", label: "Matters", icon: IconBriefcase },
  { href: "/review", label: "Review", icon: IconFileSearch },
  { href: "/research", label: "Research", icon: IconFileSearch },
];

const libraryItems = [
  { href: "/vault", label: "Vault", icon: IconFolder },
  { href: "/history", label: "Threads", icon: IconHistory },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const resetComposerState = useChatStore((state) => state.resetComposerState);

  useEffect(() => {
    const saved = safeStorage.getItem("vaultr-sidebar-collapsed");
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    setCollapsed(narrow || saved === "true");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-current-w",
      collapsed ? "var(--sidebar-collapsed-w)" : "var(--sidebar-w)",
    );
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      safeStorage.setItem("vaultr-sidebar-collapsed", String(!value));
      return !value;
    });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/c/");
    if (href === "/review") {
      return pathname.startsWith("/review") || pathname.startsWith("/contract-scanner") || pathname.startsWith("/tabular-review") || pathname.startsWith("/workflows");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const nav = (items: typeof primaryItems) => (
    <nav className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`group flex h-9 items-center rounded-[var(--radius-sm)] transition-colors ${
              collapsed ? "mx-auto w-9 justify-center" : "gap-2.5 px-2.5"
            } ${active ? "bg-[var(--surface-elevated)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"}`}
          >
            <Icon size={16} stroke={1.6} />
            {!collapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <aside className={`flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ${collapsed ? "w-[var(--sidebar-collapsed-w)]" : "w-[var(--sidebar-w)]"}`}>
      <div className={`flex h-[72px] items-center ${collapsed ? "justify-center" : "justify-between px-3"}`}>
        <Link href="/" onClick={() => resetComposerState()} className="flex items-center gap-2 text-[var(--text)]" title="Vaultr">
          <span aria-hidden className="text-[23px] leading-none">✳</span>
          {!collapsed && <span className="font-display text-[24px] leading-none">Vaultr</span>}
        </Link>
        {!collapsed && (
          <button type="button" onClick={toggleCollapsed} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-faint)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]" aria-label="Collapse sidebar">
            <IconChevronLeft size={15} />
          </button>
        )}
      </div>

      {collapsed && (
        <button type="button" onClick={toggleCollapsed} className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-faint)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]" aria-label="Expand sidebar">
          <IconChevronRight size={15} />
        </button>
      )}

      <div className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? "px-1.5" : "px-2.5"}`}>
        {!collapsed && <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Work</div>}
        {nav(primaryItems)}

        <div className="my-4 border-t border-[var(--border)]" />
        {!collapsed && <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Library</div>}
        {nav(libraryItems)}

        <button
          type="button"
          onClick={() => router.push("/matters")}
          title="New matter"
          className={`mt-5 flex h-9 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)] ${collapsed ? "mx-auto w-9 justify-center" : "w-full gap-2 px-2.5"}`}
        >
          <IconPlus size={15} />
          {!collapsed && <span className="text-[12px] font-medium">New matter</span>}
        </button>
      </div>

      <div className={`${collapsed ? "p-1.5" : "p-2.5"} pb-3`}>
        <Link href="/settings" title="Settings" className={`flex h-9 items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)] ${collapsed ? "justify-center" : "gap-2.5 px-2.5"}`}>
          <IconSettings size={16} stroke={1.6} />
          {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
