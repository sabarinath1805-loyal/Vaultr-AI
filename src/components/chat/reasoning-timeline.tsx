"use client";

import React from "react";

interface ReasoningTimelineProps {
  visible: boolean;
}

export function ReasoningTimeline({ visible }: ReasoningTimelineProps) {
  return (
    <div
      className={`lex-thinking-indicator mb-3 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="lex-thinking-indicator"
    >
      <span className="text-[15px] leading-none text-[var(--text-primary)]">✳</span>
      <span aria-hidden="true" className="w-1" />
      <span className="text-[14px] text-[var(--text-primary)]">Lex is thinking</span>
      <span className="lex-thinking-dots" aria-hidden="true">
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
    </div>
  );
}

export function SourcesFooter({ domains, urls }: { domains: string[]; urls?: Record<string, string> }) {
  if (domains.length === 0) return null;
  const safeUrls = urls || {};
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <div className="text-[12px] font-medium text-[var(--text-muted)]">Sources</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {domains.map((domain, index) => {
          const href = safeUrls[domain] || `https://${domain}`;
          return (
            <a
              key={domain}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-0.5 text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              [{index + 1}] {domain}
            </a>
          );
        })}
      </div>
    </div>
  );
}
