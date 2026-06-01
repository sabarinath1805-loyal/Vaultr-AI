"use client";

import { useState } from "react";
import type { LegalSearchResult } from "@/lib/legal-search";

const JURISDICTION_COLORS: Record<string, string> = {
  Singapore: "bg-red-500/10 text-red-400 border-red-500/20",
  UK: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  USA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Australia: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  EU: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  India: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Commonwealth: "bg-green-500/10 text-green-400 border-green-500/20",
  International: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

interface LegalSourcesPanelProps {
  searchResult: LegalSearchResult | null;
  isLoading: boolean;
}

export function LegalSourcesPanel({
  searchResult,
  isLoading,
}: LegalSourcesPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!isLoading && (!searchResult || searchResult.cases.length === 0)) {
    if (searchResult?.offline) {
      return (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          <WarningIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Citation verification unavailable in offline mode</span>
        </div>
      );
    }
    return null;
  }

  const caseCount = searchResult?.cases.length || 0;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-[var(--bg-secondary)]/50 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-secondary)]/80"
      >
        <div className="flex items-center gap-2">
          <BookOpenIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              Searching legal databases...
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              <span className="font-medium text-[var(--accent)]">
                {caseCount}
              </span>{" "}
              sources found across{" "}
              {searchResult?.databases_searched.length} databases
            </span>
          )}
        </div>
        {!isLoading && caseCount > 0 &&
          (expanded ? (
            <ChevronUpIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronDownIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          ))}
      </button>

      {expanded && searchResult && caseCount > 0 && (
        <div className="divide-y divide-[var(--border)]/30">
          {searchResult.cases.map((legalCase, index) => (
            <div
              key={index}
              className="bg-[var(--bg)]/50 px-4 py-3 transition-colors hover:bg-[var(--bg-secondary)]/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs font-medium text-[var(--text)]">
                      {legalCase.title}
                    </span>
                    {legalCase.year && (
                      <span className="text-xs text-[var(--text-muted)]">
                        [{legalCase.year}]
                      </span>
                    )}
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${JURISDICTION_COLORS[legalCase.jurisdiction] || JURISDICTION_COLORS["International"]}`}
                    >
                      {legalCase.jurisdiction}
                    </span>
                  </div>
                  {legalCase.citation && (
                    <p className="mb-1 text-[11px] text-[var(--text-muted)]">
                      {legalCase.citation}
                    </p>
                  )}
                  {legalCase.summary && (
                    <p className="line-clamp-2 text-[11px] text-[var(--text-muted)]/80">
                      {legalCase.summary}
                    </p>
                  )}
                  <span className="mt-1 block text-[10px] text-[var(--text-muted)]/50">
                    {legalCase.source}
                  </span>
                </div>
                {legalCase.url && (
                  <a
                    href={legalCase.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 rounded p-1.5 transition-colors hover:bg-[var(--accent)]/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLinkIcon className="h-3 w-3 text-[var(--accent)]" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
