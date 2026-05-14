"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, Plus, Search, X } from "lucide-react";

type Tab = "all" | "mine" | "shared-with-me";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "shared-with-me", label: "Shared with me" },
];

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[300px] shrink-0";

function HeaderSearchBtn({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        onChange("");
      }
    }

    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onChange]);

  return (
    <div ref={ref} className="relative flex items-center">
      {open ? (
        <div className="absolute right-0 top-1/2 z-10 flex w-72 -translate-y-1/2 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 shadow-sm">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
          <input
            autoFocus
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange("");
            }}
            className="text-[var(--text-faint)] hover:text-[var(--text-muted)]"
            aria-label="Close vault search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          aria-label="Search vault"
        >
          <Search className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ToolbarTabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (id: Tab) => void;
}) {
  return (
    <div className="flex h-10 items-center border-b border-[var(--border)] px-8">
      <div className="flex flex-1 items-center gap-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`text-xs transition-colors ${
              active === tab.id
                ? "font-medium text-[var(--text)]"
                : "font-normal text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        Actions
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  return (
    <main className="h-screen flex-1 overflow-y-auto bg-white">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="font-display text-2xl font-medium text-[var(--text)]">
          Vault
        </h1>
        <div className="flex items-center gap-2">
          <HeaderSearchBtn
            value={search}
            onChange={setSearch}
            placeholder="Search vault..."
          />
          <button
            type="button"
            className="flex items-center justify-center p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            aria-label="Create vault"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ToolbarTabs active={activeTab} onChange={setActiveTab} />

      <div className="w-full overflow-x-auto">
        <div className="min-w-max">
          <div className="flex h-8 items-center border-b border-[var(--border)] pr-8 text-xs font-medium text-[var(--text-muted)] select-none">
            <div className={`sticky left-0 z-[60] ${CHECK_W} relative flex self-stretch items-center justify-center bg-white before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-white`} />
            <div className={`sticky left-8 z-[60] ${NAME_COL_W} bg-white pl-2 text-left`}>
              Name
            </div>
            <div className="ml-auto w-32 shrink-0 text-left">CM</div>
            <div className="w-24 shrink-0 text-left">Files</div>
            <div className="w-24 shrink-0 text-left">Chats</div>
            <div className="w-36 shrink-0 text-left">Tabular Reviews</div>
            <div className="w-32 shrink-0 text-left">Created</div>
            <div className="w-8 shrink-0" />
          </div>

          <div className="flex w-full max-w-xs flex-col items-start py-24 mx-auto">
            <FolderOpen className="mb-4 h-8 w-8 text-[var(--text-faint)]" />
            <p className="font-display text-2xl font-medium text-[var(--text)]">
              Vault
            </p>
            <p className="mt-1 max-w-xs text-xs text-[var(--text-faint)]">
              Upload documents into the vault and commence chats and tabular reviews with them.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-[var(--text)] px-3 py-1 text-xs font-medium text-white shadow-md transition-colors hover:bg-[rgb(51,51,51)]"
            >
              + Create New
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
