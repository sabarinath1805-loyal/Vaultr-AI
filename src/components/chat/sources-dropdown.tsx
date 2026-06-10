"use client";

import React from "react";
import { Globe, X } from "lucide-react";

// Inline SVG flag icons - 20x15 ratio, optimized for dropdown display
const FLAG_ICONS: Record<string, React.ReactNode> = {
  sg: (
    <svg viewBox="0 0 640 480" className="h-3.5 w-5 shrink-0">
      <path fill="#ed2939" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M0 0h640v240H0z" />
      <path fill="#ed2939" d="M0 0h240v240H0z" />
      <circle cx="180" cy="120" r="60" fill="#fff" />
      <path fill="#ed2939" d="M150 180c-33.118 0-60-26.882-60-60 0-33.118 26.882-60 60-60 33.118 0 60 26.882 60 60 0 33.118-26.882 60-60 60z" />
      <path fill="#fff" d="m150 145 5.65 17.4h18.35l-14.85 10.8 5.65 17.4-14.8-10.75-14.85 10.75 5.7-17.4-14.9-10.8h18.4z" />
    </svg>
  ),
  gb: (
    <svg viewBox="0 0 640 480" className="h-3.5 w-5 shrink-0">
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M0 0h640v240H0z" />
      <path fill="#c8102e" d="M0 0h640v240H0z" />
      <path fill="#fff" d="M213.33 0v480M426.67 0v480" />
      <path fill="#c8102e" d="M213.33 0L0 240M426.67 0L640 240" />
    </svg>
  ),
  au: (
    <svg viewBox="0 0 1280 960" className="h-3.5 w-5 shrink-0">
      <path fill="#00008b" d="M0 0h1280v960H0z" />
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#ff0000" d="M0 0h320v320H0z" />
      <path fill="#00008b" d="M0 480h640v480H0z" />
      <path fill="#ff0000" d="M0 640h320v320H0z" />
      <path fill="#fff" d="M320 0v320h320V0zM0 160h320v320H0z" />
      <path fill="#ff0000" d="M0 0v32l-32 32V0h32zM640 0v32l32 32V0h-32zM0 640v32l-32 32v-32h32zM640 640v32l32 32v-32h-32zM0 960v-32l-32-32v32h32zM640 960v-32l32-32v32h-32zM1280 640v32l32-32v-32h-32zM640 640v32l-32-32v32h32zM1280 960v-32l32 32v32h-32zM640 960v-32l32 32v32h-32z" />
    </svg>
  ),
  ca: (
    <svg viewBox="0 0 1200 600" className="h-3.5 w-5 shrink-0">
      <path fill="#ff0000" d="M0 0v600h1200V0H0z" />
      <path fill="#fff" d="M0 0v600h200V0H0zM400 0v600h400V0H400zM800 0v600h200V0H800z" />
      <path fill="#ff0000" d="M0 150h1200v300H0z" />
      <path fill="#fff" d="M350 0h100v600H350zM750 0h100v600H750z" />
    </svg>
  ),
  us: (
    <svg viewBox="0 0 1235 650" className="h-3.5 w-5 shrink-0">
      <path fill="#bf0a2c" d="M0 0h1235v650H0z" />
      <path fill="#fff" d="M0 0h1235v50l-1235 50V0zM0 100h1235v50l-1235 50V100zM0 200h1235v50l-1235 50V200zM0 300h1235v50l-1235 50V300zM0 400h1235v50l-1235 50V400zM0 500h1235v50l-1235 50V500zM0 600h1235v50l-1235 50V600z" />
      <path fill="#002868" d="M0 0h494v350H0z" />
      <circle cx="76.9" cy="87.5" r="13.33" fill="#fff" />
      <circle cx="76.9" cy="131.25" r="13.33" fill="#fff" />
      <path fill="#fff" d="M0 50h494v350H0z" />
    </svg>
  ),
  intl: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
    </svg>
  ),
};

function FlagIcon({ jurisdictionId }: { jurisdictionId: string; className?: string }) {
  return FLAG_ICONS[jurisdictionId] || FLAG_ICONS.intl;
}

export interface JurisdictionSource {
  id: string;
  flagClass: string;
  name: string;
  sites: string;
}

export const JURISDICTION_SOURCES: JurisdictionSource[] = [
  {
    id: "sg",
    flagClass: "fi fi-sg",
    name: "Singapore",
    sites: "site:judiciary.gov.sg OR site:singaporelawwatch.sg",
  },
  {
    id: "gb",
    flagClass: "fi fi-gb",
    name: "United Kingdom",
    sites: "site:bailii.org",
  },
  {
    id: "au",
    flagClass: "fi fi-au",
    name: "Australia",
    sites: "site:austlii.edu.au",
  },
  {
    id: "ca",
    flagClass: "fi fi-ca",
    name: "Canada",
    sites: "site:canlii.org",
  },
  {
    id: "us",
    flagClass: "fi fi-us",
    name: "United States",
    sites: "site:courtlistener.com",
  },
  {
    id: "intl",
    flagClass: "",
    name: "International",
    sites: "unrestricted web search",
  },
];

const JURISDICTION_BADGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  sg: { label: "SG", bg: "#d4edda", text: "#155724" },
  gb: { label: "UK", bg: "#cce5ff", text: "#004085" },
  au: { label: "AU", bg: "#fff3cd", text: "#856404" },
  us: { label: "US", bg: "#d6d8e7", text: "#1b1e4b" },
  eu: { label: "EU", bg: "#cce5ff", text: "#004085" },
  ca: { label: "CA", bg: "#f8d7da", text: "#721c24" },
  intl: { label: "INT", bg: "#e2e3e5", text: "#383d41" },
};

function JurisdictionBadge({ source }: { source: JurisdictionSource }) {
  const style = JURISDICTION_BADGE_STYLES[source.id] || JURISDICTION_BADGE_STYLES.intl;
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 6px",
        borderRadius: "4px",
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <FlagIcon jurisdictionId={source.id} className="mr-1" />
      {style.label}
    </span>
  );
}

interface SourcesDropdownProps {
  selectedSources: string[];
  onToggleSource: (sourceId: string) => void;
}

export function SourcesDropdown({
  selectedSources,
  onToggleSource,
}: SourcesDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        className={`flex h-8 items-center gap-1.5 rounded-lg px-[10px] py-[6px] text-sm transition-colors ${
          selectedSources.length > 0
            ? "text-[var(--blue)] hover:bg-[var(--bg-tertiary)]"
            : "text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
        }`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Select sources"
        data-testid="sources-button"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sources</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 shadow-lg"
          data-testid="sources-dropdown"
        >
          <div className="mb-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Jurisdictions
          </div>
          {JURISDICTION_SOURCES.map((source) => {
            const isSelected = selectedSources.includes(source.id);
            return (
              <label
                key={source.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSource(source.id)}
                  className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--blue)]"
                />
                <FlagIcon jurisdictionId={source.id} />
                <JurisdictionBadge source={source} />
                <span className="text-[13px] text-[var(--text-primary)]">
                  {source.name}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SourcePills({
  selectedSources,
  onRemove,
}: {
  selectedSources: string[];
  onRemove: (sourceId: string) => void;
}) {
  if (selectedSources.length === 0) return null;
  return (
    <>
      {selectedSources.map((sourceId) => {
        const source = JURISDICTION_SOURCES.find((s) => s.id === sourceId);
        if (!source) return null;
        return (
          <div
            key={sourceId}
            className="inline-flex items-center gap-1 rounded-full border-[0.5px] border-[var(--color-border-primary)] bg-[var(--color-background-primary)] py-0.5 pl-2 pr-1 text-xs text-[var(--color-text-primary)]"
          >
            <span className="text-[10px] leading-none text-[var(--text-muted)]">
              <JurisdictionBadge source={source} />
            </span>
            <span className="max-w-[100px] truncate">{source.name}</span>
            <button
              type="button"
              onClick={() => onRemove(sourceId)}
              className="ml-0.5 rounded-full p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
              aria-label={`Remove ${source.name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </>
  );
}

export function buildJurisdictionPrompt(selectedSourceIds: string[]): string {
  if (selectedSourceIds.length === 0) return "";
  const selected = selectedSourceIds
    .map((id) => JURISDICTION_SOURCES.find((s) => s.id === id))
    .filter(Boolean) as JurisdictionSource[];

  const countryNames = selected.map((s) => s.name).join(", ");
  const siteLines = selected
    .map((s) => `- ${s.name}: ${s.sites}`)
    .join("\n");

  return `\n\nThe lawyer has selected these jurisdictions for case law research:\n${countryNames}. When searching for cases, target these sources by jurisdiction:\n${siteLines}\n\nOnly cite cases found via web search from these sources.\nNever cite from memory.`;
}
