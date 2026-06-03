"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface ThinkingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
}

const ROTATING_PHRASES = [
  "Detecting jurisdiction...",
  "Searching legal databases...",
  "Analysing case law...",
  "Running web search...",
  "Synthesising response...",
];

export function ThinkingProcess({ steps, isStreaming }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % ROTATING_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      setIsOpen(false);
    }
  }, [isStreaming]);

  const toggleOpen = useCallback(() => {
    if (!isStreaming) setIsOpen((v) => !v);
  }, [isStreaming]);

  const activeStep = steps.find((s) => s.status === "active");
  const headerLabel = isStreaming
    ? activeStep?.label || ROTATING_PHRASES[phraseIndex]
    : `${steps.filter((s) => s.status === "done").length} steps completed`;

  if (steps.length === 0) return null;

  return (
    <div className="mb-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-sm">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        {isStreaming ? (
          <div className="h-3 w-3 shrink-0 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        ) : (
          <div className="h-3 w-3 shrink-0 rounded-full bg-[var(--accent)]" />
        )}
        <span className="flex-1 font-medium text-[13px]">{headerLabel}</span>
        {!isStreaming && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
          />
        )}
      </button>
      {(isOpen || isStreaming) && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2 py-1">
              {step.status === "active" ? (
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full border border-[var(--accent)] border-t-transparent animate-spin" />
              ) : step.status === "done" ? (
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
              ) : (
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-40" />
              )}
              <div className="flex-1">
                <span
                  className={`text-[12px] ${
                    step.status === "active"
                      ? "text-[var(--text-primary)] font-medium"
                      : step.status === "done"
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="ml-1 text-[11px] text-[var(--text-tertiary)]">
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
