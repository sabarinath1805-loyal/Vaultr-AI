"use client";

import React from "react";
import { Globe, X } from "lucide-react";

export interface JurisdictionSource {
  id: string;
  flag: string;
  name: string;
  sites: string;
}

export const JURISDICTION_SOURCES: JurisdictionSource[] = [
  {
    id: "sg",
    flag: "\u{1F1F8}\u{1F1EC}",
    name: "Singapore",
    sites: "site:judiciary.gov.sg OR site:singaporelawwatch.sg",
  },
  {
    id: "gb",
    flag: "\u{1F1EC}\u{1F1E7}",
    name: "United Kingdom",
    sites: "site:bailii.org",
  },
  {
    id: "au",
    flag: "\u{1F1E6}\u{1F1FA}",
    name: "Australia",
    sites: "site:austlii.edu.au",
  },
  {
    id: "ca",
    flag: "\u{1F1E8}\u{1F1E6}",
    name: "Canada",
    sites: "site:canlii.org",
  },
  {
    id: "us",
    flag: "\u{1F1FA}\u{1F1F8}",
    name: "United States",
    sites: "site:courtlistener.com",
  },
  {
    id: "intl",
    flag: "\u{1F30D}",
    name: "International",
    sites: "unrestricted web search",
  },
];

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors ${
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
                <span className="text-base leading-none">{source.flag}</span>
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
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--white)]/20 bg-[var(--blue)] py-0.5 pl-2 pr-1 text-xs text-[var(--white)] shadow backdrop-blur-sm"
          >
            <span className="text-[10px] leading-none">{source.flag}</span>
            <span className="max-w-[100px] truncate">{source.name}</span>
            <button
              type="button"
              onClick={() => onRemove(sourceId)}
              className="ml-0.5 rounded-full p-0.5 text-[var(--white)]/60 transition-colors hover:bg-[var(--bg)]/20 hover:text-[var(--white)]"
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
