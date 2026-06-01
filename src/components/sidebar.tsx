"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconMessage2,
  IconFolder,
  IconBriefcase,
  IconScan,
  IconChartBar,
  IconHistory,
  IconSettings,
  IconPlus,
  IconLayoutSidebar,
} from "@tabler/icons-react";
import { Grid2X2 } from "lucide-react";
import useChatStore from "@/app/hooks/useChatStore";

const navItems = [
  { href: "/", label: "Lex", icon: IconMessage2 },
  { href: "/vault", label: "Vault", icon: IconFolder },
  { href: "/matters", label: "Matters", icon: IconBriefcase },
  { href: "/models", label: "Models", icon: Grid2X2 },
  { href: "/contract-scanner", label: "Contract Scanner", icon: IconScan },
  { href: "/workflows", label: "Workflows", icon: IconChartBar },
  { href: "/history", label: "Threads", icon: IconHistory },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

const navClass =
  "flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm text-[var(--text)] transition-[background-color] duration-150";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const resetComposerState = useChatStore((state) => state.resetComposerState);
  const cloudMode = useChatStore((state) => state.cloudMode);

  useEffect(() => {
    const saved = window.localStorage.getItem("vaultr-sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-current-w", collapsed ? "40px" : "220px");
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      window.localStorage.setItem("vaultr-sidebar-collapsed", String(!value));
      return !value;
    });
  };

  const isNavActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/c/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className={`flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-in-out ${collapsed ? "w-10" : "w-[var(--sidebar-w)]"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center px-1" : "justify-between px-3"} pb-[14px] pt-[52px]`}>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[var(--text)]"
          title="Vaultr"
          onClick={() => resetComposerState()}
        >
          <span style={{ fontSize: '36px', fontFamily: 'serif', lineHeight: 1, position: 'relative', top: '-2px' }}>✳</span>
          {!collapsed && <span className="text-[18px] font-medium leading-none">Vaultr</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`${collapsed ? "hidden" : "flex"} h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconLayoutSidebar size={16} />
        </button>
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
          aria-label="Expand sidebar"
        >
          <IconLayoutSidebar size={16} />
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <nav className="flex flex-col gap-1">
          {navItems
            .filter((item) => !cloudMode || item.href !== "/models")
            .map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href);
            return (
              <Link
                key={label}
                href={href}
                title={label}
                className={`${collapsed ? "mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] px-0" : navClass} ${
                  active
                    ? "bg-[var(--bg-tertiary)] font-medium"
                    : "font-normal hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <Icon
                  size={16}
                  className={
                    active ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  }
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              resetComposerState();
              router.push("/");
            }}
            className="mt-4 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-[7px] text-[13px] text-[var(--text)] transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <IconPlus className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            New Thread
          </button>
        )}
      </div>
    </aside>
  );
}
