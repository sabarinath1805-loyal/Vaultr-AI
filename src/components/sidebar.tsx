"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
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
  { href: "/models", label: "Models", icon: Grid2X2 },
  { href: "/contract-scanner", label: "Contract Scanner", icon: Shield },
  { href: "/workflows", label: "Workflows", icon: BarChart3 },
];

const navClass =
  "flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm text-[var(--text)] transition-[color,background-color] duration-150";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(true);
  const chats = useChatStore((state) => state.chats);
  const handleDelete = useChatStore((state) => state.handleDelete);
  const loadChats = useChatStore((state) => state.loadChats);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const activeChatId = pathname.startsWith("/c/") ? pathname.split("/")[2] : "";
  const sortedChats = Object.entries(chats).sort(
    ([, a], [, b]) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const isNavActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/c/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="flex items-center justify-between px-4 py-[14px]">
        <Link href="/" className="flex items-center gap-2 text-[var(--text)]">
          <SnowflakeIcon size={16} />
          <span className="text-sm font-medium">Vaultr</span>
        </Link>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[rgb(240,238,234)] hover:text-[var(--text)]"
          aria-label="Collapse sidebar"
        >
          <PanelLeft size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href);
            return (
              <Link
                key={label}
                href={href}
                className={`${navClass} ${
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
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-4">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="flex w-full items-center justify-between px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--text-muted)] transition-[color,background-color] duration-150"
          >
            <span>Assistant History</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-150 ${
                historyOpen ? "" : "-rotate-90"
              }`}
            />
          </button>

          {historyOpen && (
            <div className="flex flex-col gap-0.5">
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
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--border)] text-xs font-medium text-[var(--text)]">
          L
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-[var(--text)]">
            Local User
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">Solo</div>
        </div>
        <ChevronsUpDown size={14} className="text-[var(--text-muted)]" />
      </div>
    </aside>
  );
}