"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Edit3,
  Folder,
  Grid2X2,
  MoreHorizontal,
  PanelLeft,
  Shield,
  Square,
  Trash2,
  X,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chats = useChatStore((state) => state.chats);
  const handleDelete = useChatStore((state) => state.handleDelete);
  const clearAllChatsAction = useChatStore((state) => state.clearAllChats);
  const loadChats = useChatStore((state) => state.loadChats);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const userName = useChatStore((state) => state.userName);
  const setUserName = useChatStore((state) => state.setUserName);

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

  const exportConversations = () => {
    const blob = new Blob([JSON.stringify(chats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vaultr-conversations.json";
    link.click();
    URL.revokeObjectURL(url);
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
        <Link href="/" className="flex items-center gap-2 text-[var(--text)]" title="Vaultr">
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
              setCurrentChatId(null);
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

      <button type="button" onClick={() => setSettingsOpen(true)} className={`flex items-center gap-2 border-t border-[var(--border)] p-3 text-left transition-colors hover:bg-[rgb(240,238,234)] ${collapsed ? "justify-center px-1" : ""}`}>
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
      {settingsOpen && (
        <AccountPanel
          userName={userName}
          onUserNameChange={setUserName}
          onClose={() => setSettingsOpen(false)}
          onClearAll={clearAllChats}
          onExport={exportConversations}
        />
      )}
    </aside>
  );
}

function TogglePreference({ label, storageKey }: { label: string; storageKey: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(storageKey) === "true");
  }, [storageKey]);

  return (
    <button
      type="button"
      onClick={() => {
        setEnabled((value) => {
          window.localStorage.setItem(storageKey, String(!value));
          return !value;
        });
      }}
      className="flex w-full items-center justify-between py-2 text-left text-[13px] text-[var(--text)]"
    >
      <span>{label}</span>
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${enabled ? "bg-[var(--text)]" : "bg-[var(--border)]"}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function AccountPanel({
  userName,
  onUserNameChange,
  onClose,
  onClearAll,
  onExport,
}: {
  userName: string;
  onUserNameChange: (name: string) => void;
  onClose: () => void;
  onClearAll: () => Promise<void>;
  onExport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(0,0,0,0.3)]" onClick={onClose}>
      <div
        className="w-[400px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Account</h2>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface)]" aria-label="Close account panel">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--border)] text-lg font-medium text-[var(--text)]">L</div>
          <div className="min-w-0 flex-1">
            <input
              value={userName}
              onChange={(event) => onUserNameChange(event.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[13px] font-medium text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
              aria-label="Account name"
            />
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">
              Plan: Solo · <span className="underline underline-offset-2">Upgrade to Enterprise</span>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.02em] text-[var(--text-muted)]">Preferences</h3>
          <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3">
            <TogglePreference label="Show thinking process" storageKey="vaultr-show-thinking" />
            <div className="border-t border-[var(--border)]" />
            <TogglePreference label="Compact message view" storageKey="vaultr-compact-messages" />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.02em] text-[var(--text-muted)]">Data</h3>
          <div className="mt-2 flex flex-col gap-2">
            <button type="button" onClick={onClearAll} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-left text-[13px] text-[rgb(229,62,62)] transition-colors hover:bg-[rgb(255,240,240)]">
              Clear all conversations
            </button>
            <button type="button" onClick={onExport} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-left text-[13px] text-[var(--text)] transition-colors hover:bg-[var(--surface)]">
              <Download className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              Export conversations
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
