"use client";

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
