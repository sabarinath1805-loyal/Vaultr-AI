"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

interface HeaderSearchBtnProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function HeaderSearchBtn({
  value,
  onChange,
  placeholder = "Search...",
}: HeaderSearchBtnProps) {
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
        <div className="absolute right-0 top-1/2 z-10 flex w-72 -translate-y-1/2 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 shadow-sm">
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
            aria-label="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
