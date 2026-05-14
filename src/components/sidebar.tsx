"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronsUpDown,
  Edit3,
  Folder,
  Grid2X2,
  MoreHorizontal,
  PanelLeft,
  Shield,
  Square,
  Trash2,
} from "lucide-react";
import { SnowflakeIcon } from "@/components/icons/snowflake";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useChatStore from "@/app/hooks/useChatStore";

const navItems = [
  { href: "/", label: "Assistant", icon: Square },
  { href: "/vault", label: "Vault", icon: Folder },
  { href: "/matters", label: "Matters", icon: Briefcase },
  { href: "/models", label: "Models", icon: Grid2X2 },
  { href: "/contract-scanner", label: "Contract Scanner", icon: Shield },
  { href: "/workflows", label: "Workflows", icon: BarChart3 },
];

const navClass =
  "flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm text-[var(--text)] transition-[background-color] duration-150";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const chats = useChatStore((state) => state.chats);
  const handleDelete = useChatStore((state) => state.handleDelete);
  const clearAllChatsAction = useChatStore((state) => state.clearAllChats);
  const loadChats = useChatStore((state) => state.loadChats);
  const resetComposerState = useChatStore((state) => state.resetComposerState);
  const userName = useChatStore((state) => state.userName);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const saved = window.localStorage.getItem("vaultr-sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      window.localStorage.setItem("vaultr-sidebar-collapsed", String(!value));
      return !value;
    });
  };

  const activeChatId = pathname.startsWith("/c/") ? pathname.split("/")[2] : "";
  const sortedChats = Object.entries(chats).sort(
    ([, a], [, b]) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );


  const clearAllChats = async () => {
    if (!window.confirm("Delete all conversations? This cannot be undone.")) return;
    await clearAllChatsAction();
    router.push("/");
  };

  const isNavActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/c/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className={`flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-in-out ${collapsed ? "w-10" : "w-[var(--sidebar-w)]"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center px-1" : "justify-between px-4"} py-[14px]`}>
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--text)]"
          title="Vaultr"
          onClick={() => resetComposerState()}
        >
          <SnowflakeIcon size={16} />
          {!collapsed && <span className="text-sm font-medium">Vaultr</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`${collapsed ? "hidden" : "flex"} h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[rgb(240,238,234)] hover:text-[var(--text)]`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[rgb(240,238,234)] hover:text-[var(--text)]"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={16} />
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href);
            return (
              <Link
                key={label}
                href={href}
                title={label}
                className={`${collapsed ? "mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] px-0" : navClass} ${
                  active
                    ? "bg-[rgb(238,236,232)] font-medium"
                    : "font-normal hover:bg-[rgb(240,238,234)]"
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
            className="mt-4 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-[7px] text-[13px] text-[var(--text)] transition-colors hover:bg-[rgb(240,238,234)]"
          >
            <Edit3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            New Chat
          </button>
        )}

        {!collapsed && <div className="pt-4">
          <div className="flex items-center justify-between px-3 pb-1.5">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <span>Assistant History</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${
                  historyOpen ? "" : "-rotate-90"
                }`}
              />
            </button>
            {sortedChats.length > 0 && (
              <button
                type="button"
                onClick={clearAllChats}
                className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[rgb(229,62,62)]"
              >
                Clear all
              </button>
            )}
          </div>

          {historyOpen && (
            <div className="flex flex-col gap-0.5">
              {sortedChats.length === 0 && (
                <div className="px-3 py-6 text-center text-[13px] text-[var(--text-faint)]">
                  No conversations yet
                </div>
              )}
              {sortedChats.map(([id, chat]) => {
                const storedTitle = chat.title === "New chat" ? "Assistant" : chat.title;
                const title =
                  chat.messages[0]?.content.trim() || storedTitle || "Untitled";
                const active = id === activeChatId;
                return (
                  <div key={id} className="group flex items-center">
                    <Link
                      href={`/c/${id}`}
                      className={`min-w-0 flex-1 truncate rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[rgb(240,238,234)] ${
                        active ? "font-semibold" : "font-normal"
                      }`}
                      title={title}
                    >
                      {title}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="mr-1 hidden h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[rgb(240,238,234)] hover:text-[var(--text)] group-hover:flex"
                          aria-label="Chat options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-none">
                        <Dialog>
                          <DialogTrigger asChild>
                            <DropdownMenuItem
                              className="gap-2 text-[rgb(229,62,62)] focus:bg-[var(--surface)] focus:text-[rgb(229,62,62)]"
                              onSelect={(event) => event.preventDefault()}
                            >
                              <Trash2 size={14} />
                              Delete
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DialogContent className="border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-none">
                            <DialogHeader>
                              <DialogTitle>Delete chat?</DialogTitle>
                              <DialogDescription>
                                This removes the chat and all saved messages.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                className="rounded-[var(--radius-sm)] bg-[rgb(229,62,62)] px-4 py-2 text-sm text-white"
                                onClick={async () => {
                                  await handleDelete(id);
                                  if (id === activeChatId) {
                                    router.push("/");
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </div>

      <button type="button" onClick={() => router.push("/settings")} className={`flex items-center gap-2 border-t border-[var(--border)] p-3 text-left transition-colors hover:bg-[rgb(240,238,234)] ${collapsed ? "justify-center px-1" : ""}`}>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--border)] text-xs font-medium text-[var(--text)]">
          L
        </div>
        {!collapsed && (<>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--text)]">
              {userName}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">Solo</div>
          </div>
          <ChevronsUpDown size={14} className="text-[var(--text-muted)]" />
        </>)}
      </button>
    </aside>
  );
}
