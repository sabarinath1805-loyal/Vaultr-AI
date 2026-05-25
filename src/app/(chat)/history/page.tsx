"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import useChatStore from "@/app/hooks/useChatStore";

export default function HistoryPage() {
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const loadChats = useChatStore((state) => state.loadChats);
  const handleDelete = useChatStore((state) => state.handleDelete);
  const clearAllChats = useChatStore((state) => state.clearAllChats);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const sortedChats = Object.entries(chats).sort(
    ([, a], [, b]) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <main className="flex h-screen flex-col overflow-y-auto bg-[var(--bg)]">
      <header className="mx-auto flex h-16 w-full max-w-3xl shrink-0 items-end px-6 pb-2 md:h-24 md:pb-4">
        <div className="flex w-full items-baseline justify-between">
          <h1 className="text-[28px] font-normal text-[var(--text)]">Threads</h1>
          {sortedChats.length > 0 && (
            !confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="text-[13px] text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                Clear all
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => { await clearAllChats(); setConfirmClearAll(false); router.push("/"); }}
                  className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1 text-[13px] text-[var(--white)] hover:bg-[var(--danger-hover)]"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-10 pt-4">
        {sortedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center font-[family-name:var(--font-sans)]">
            <MessageSquare className="mb-4 h-10 w-10 text-[var(--text-faint)]" />
            <p className="text-[28px] font-normal text-[var(--text)]">No threads yet</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Start a new thread with Lex to see your history here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortedChats.map(([id, chat]) => {
              const title = chat.title === "New chat"
                ? (chat.messages[0]?.content.trim() || "Untitled")
                : (chat.title || "Untitled");
              const date = new Date(chat.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const messageCount = chat.messages.length;

              return (
                <div key={id} className="group relative flex items-center rounded-[var(--radius-md)] border border-transparent px-4 py-3 transition-colors hover:border-[var(--border)] hover:bg-[var(--sidebar-bg)]">
                  <Link
                    href={`/c/${id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--text)]">{title}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-faint)]">
                        {messageCount} message{messageCount !== 1 ? "s" : ""} · {date}
                      </div>
                    </div>
                  </Link>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(menuOpenId === id ? null : id)}
                      className="hidden h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] group-hover:flex"
                      aria-label="Thread options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpenId === id && (
                      <div className="absolute right-0 top-8 z-10 w-36 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_4px_12px_var(--shadow-soft)]">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDelete(id);
                            setMenuOpenId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
      </div>
    </main>
  );
}
