"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  FileSearch,
  Folder,
  History,
  Library,
  MessageSquare,
  PanelLeft,
  Table2,
  Workflow,
} from "lucide-react";
import useChatStore from "@/app/hooks/useChatStore";

const navItems = [
  { href: "/", label: "Lex", icon: MessageSquare },
  { href: "/matters", label: "Matters", icon: Folder },
  { href: "/vault", label: "Vault", icon: Library },
  { href: "/tabular-review", label: "Tabular Review", icon: Table2 },
  { href: "/workflows", label: "Workflows", icon: Workflow },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function featureIcon(Icon: React.ComponentType<{ className?: string }>, active: boolean) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border shadow-sm ${
        active
          ? "border-white bg-white text-gray-900"
          : "border-white/80 bg-gradient-to-b from-white to-gray-100 text-gray-700"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const loadChats = useChatStore((state) => state.loadChats);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const resetComposerState = useChatStore((state) => state.resetComposerState);
  const userName = useChatStore((state) => state.userName);
  const organisation = useChatStore((state) => state.organisation);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const recentChats = useMemo(
    () =>
      Object.values(chats ?? {})
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 12),
    [chats],
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/c/");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[98] bg-gray-300/20 md:hidden"
          onClick={onToggle}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`vaultr-liquid absolute z-[99] my-2 ml-2 flex h-[calc(100dvh-1rem)] flex-col overflow-visible rounded-2xl transition-all duration-300 md:relative md:my-3 md:ml-3 md:h-[calc(100dvh-1.5rem)] ${
          isOpen ? "w-64" : "max-md:hidden w-14"
        }`}
      >
        <div className="flex items-center justify-between px-2.5 py-3">
          {isOpen && (
            <Link
              href="/"
              onClick={() => resetComposerState()}
              className="flex items-center gap-1.5 px-2 transition-opacity hover:opacity-80"
            >
              <span className="flex h-[22px] w-[22px] items-center justify-center text-[21px] leading-none text-gray-900">⁂</span>
              <span className="font-display text-2xl font-light text-gray-900">Vaultr</span>
            </Link>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-white/70"
            title={isOpen ? "Close sidebar" : "Open sidebar"}
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="px-2.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                title={!isOpen ? label : undefined}
                className={`my-0.5 flex h-9 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-white/85 text-gray-900 shadow-sm" : "text-gray-700 hover:bg-white/60"
                }`}
              >
                {featureIcon(Icon, active)}
                {isOpen && <span className="truncate text-sm font-medium">{label}</span>}
              </button>
            );
          })}
        </div>

        {isOpen && (
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
            <section>
              <button
                type="button"
                onClick={() => setToolsCollapsed((value) => !value)}
                className="mb-2 flex w-full items-center justify-between px-5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700"
              >
                <span>Review tools</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolsCollapsed ? "-rotate-90" : ""}`} />
              </button>
              {!toolsCollapsed && (
                <div className="space-y-1 px-2.5">
                  <Link href="/contract-scanner" className="flex h-8 items-center gap-2 rounded-md px-2.5 text-xs text-gray-700 transition-colors hover:bg-white/60">
                    <FileSearch className="h-3.5 w-3.5" />
                    <span>Contract Scanner</span>
                  </Link>
                  <Link href="/review" className="flex h-8 items-center gap-2 rounded-md px-2.5 text-xs text-gray-700 transition-colors hover:bg-white/60">
                    <Table2 className="h-3.5 w-3.5" />
                    <span>Review hub</span>
                  </Link>
                </div>
              )}
            </section>

            <section className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => setHistoryCollapsed((value) => !value)}
                className="mb-2 flex w-full items-center justify-between px-5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700"
              >
                <span>Lex History</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyCollapsed ? "-rotate-90" : ""}`} />
              </button>

              {!historyCollapsed && (
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5">
                  {recentChats.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-gray-500">No chats yet</div>
                  ) : (
                    <div className="space-y-1">
                      {recentChats.map((chat) => {
                        const active = pathname === `/c/${chat.id}`;
                        return (
                          <button
                            key={chat.id}
                            type="button"
                            onClick={() => {
                              setCurrentChatId(chat.id);
                              router.push(`/c/${chat.id}`);
                            }}
                            className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs transition-colors ${
                              active ? "bg-white/85 text-gray-900 shadow-sm" : "text-gray-700 hover:bg-white/60"
                            }`}
                            title={chat.title || "Untitled thread"}
                          >
                            <History className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                            <span className="truncate">{chat.title || "Untitled thread"}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        <div className="mt-auto p-1">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className={`flex w-full items-center border-t border-white/60 px-2.5 py-3 transition-colors hover:bg-white/60 ${isOpen ? "rounded-xl" : "justify-center rounded-xl"}`}
            title={!isOpen ? "Settings" : undefined}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700 font-display text-sm font-medium text-white">
              {(userName || "V").trim().charAt(0).toUpperCase()}
            </div>
            {isOpen && (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pl-3 text-left">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-gray-900">{userName || "Vaultr user"}</div>
                  <div className="truncate text-[10px] text-gray-500">{organisation || "Settings"}</div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
