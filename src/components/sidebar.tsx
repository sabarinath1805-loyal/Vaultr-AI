"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  Edit3,
  Folder,
  Grid2X2,
  MoreHorizontal,
  PanelLeft,
  Shield,
  Square,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useChatStore from "@/app/hooks/useChatStore";
import { getFixedDropdownPosition, type DropdownPosition } from "@/lib/dropdown-position";

const navItems = [
  { href: "/", label: "Lex", icon: Square },
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
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState<DropdownPosition | null>(null);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const chats = useChatStore((state) => state.chats);
  const handleDelete = useChatStore((state) => state.handleDelete);
  const renameChat = useChatStore((state) => state.renameChat);
  const clearAllChatsAction = useChatStore((state) => state.clearAllChats);
  const loadChats = useChatStore((state) => state.loadChats);
  const resetComposerState = useChatStore((state) => state.resetComposerState);
  const cloudMode = useChatStore((state) => state.cloudMode);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const saved = window.localStorage.getItem("vaultr-sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-current-w", collapsed ? "40px" : "220px");
  }, [collapsed]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-chat-actions]")) {
        return;
      }
      setOpenChatMenuId(null);
    };
    document.addEventListener("click", closeMenus);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenChatMenuId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
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
    await clearAllChatsAction();
    router.push("/");
    setClearAllOpen(false);
  };

  const openRenameChat = (chatId: string, title: string) => {
    setRenameChatId(chatId);
    setRenameDraft(title);
    setOpenChatMenuId(null);
  };

  const confirmRenameChat = async () => {
    if (!renameChatId || !renameDraft.trim()) return;
    await renameChat(renameChatId, renameDraft);
    setRenameChatId(null);
    setRenameDraft("");
  };

  const confirmDeleteChat = async () => {
    if (!deleteChatId) return;
    await handleDelete(deleteChatId);
    if (deleteChatId === activeChatId) {
      router.push("/");
    }
    setDeleteChatId(null);
  };

  const isNavActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/c/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className={`flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-in-out ${collapsed ? "w-10" : "w-[var(--sidebar-w)]"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center px-1" : "justify-center gap-2"} pb-[14px] pt-[52px]`}>
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--text)]"
          title="Vaultr"
          onClick={() => resetComposerState()}
        >
          <span style={{ fontSize: '18px', fontFamily: 'serif', lineHeight: 1 }}>✳</span>
          {!collapsed && <span className="text-[18px] font-medium leading-none">Vaultr</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`${collapsed ? "hidden" : "flex"} h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={16} />
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
              <span>Lex History</span>
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
                onClick={() => setClearAllOpen(true)}
                className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
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
                const storedTitle = chat.title === "New chat" ? "Lex" : chat.title;
                const title =
                  chat.messages[0]?.content.trim() || storedTitle || "Untitled";
                const active = id === activeChatId;
                return (
                  <div key={id} className="group flex items-center">
                    <Link
                      href={`/c/${id}`}
                      className={`min-w-0 flex-1 truncate rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--bg-tertiary)] ${
                        active ? "font-medium" : "font-normal"
                      }`}
                      title={title}
                    >
                      {title}
                    </Link>
                    <div className="relative" data-chat-actions>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenChatMenuId((current) => {
                            if (current === id) {
                              setChatMenuPosition(null);
                              return null;
                            }
                            setChatMenuPosition(getFixedDropdownPosition(event.currentTarget, 128, 84));
                            return id;
                          });
                        }}
                        className="mr-1 hidden h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)] group-hover:flex"
                        aria-label="Chat options"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {openChatMenuId === id && (
                        <div
                          className="fixed z-50 w-32 rounded-[6px] border border-[var(--border)] bg-[var(--bg-primary)] p-1 text-[13px] text-[var(--text-primary)] shadow-[0_4px_12px_var(--shadow-soft)]"
                          style={{
                            top: chatMenuPosition?.top ?? 0,
                            left: chatMenuPosition?.left ?? 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openRenameChat(id, title)}
                            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--bg-tertiary)]"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteChatId(id);
                              setOpenChatMenuId(null);
                            }}
                            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--danger)] hover:bg-[var(--bg-tertiary)]"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </div>
      <Dialog open={Boolean(renameChatId)} onOpenChange={(open) => !open && setRenameChatId(null)}>
        <DialogContent className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text)] shadow-[0_8px_32px_var(--shadow-modal)]">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-normal text-[var(--text)]">Rename chat</DialogTitle>
          </DialogHeader>
          <input
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:space-x-0">
            <button type="button" onClick={() => setRenameChatId(null)} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)]">
              Cancel
            </button>
            <button type="button" onClick={confirmRenameChat} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80">
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteChatId)} onOpenChange={(open) => !open && setDeleteChatId(null)}>
        <DialogContent className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text)] shadow-[0_8px_32px_var(--shadow-modal)]">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-normal text-[var(--text)]">Delete chat?</DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-secondary)]">
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <button type="button" onClick={() => setDeleteChatId(null)} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)]">
              Cancel
            </button>
            <button type="button" onClick={confirmDeleteChat} className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2 text-[13px] text-[var(--white)] transition-colors hover:bg-[var(--danger-hover)]">
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text)] shadow-[0_8px_32px_var(--shadow-modal)]">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-normal">Delete all conversations?</DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-secondary)]">
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={() => setClearAllOpen(false)}
              className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={clearAllChats}
              className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2 text-[13px] font-medium text-[var(--white)] transition-colors hover:bg-[var(--danger-hover)]"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
