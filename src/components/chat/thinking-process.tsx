"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { ANTHROPIC_MAX_MODEL } from "@/lib/models";

export interface ThinkingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
  activeModel?: string | null;
  reasoningContent?: string;
  citationMatchCount?: number;
}

const ROTATING_PHRASES = [
  "Detecting jurisdiction...",
  "Searching legal databases...",
  "Analysing case law...",
  "Running web search...",
  "Synthesising response...",
];

export function ThinkingProcess({ steps, isStreaming, activeModel, reasoningContent, citationMatchCount }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const isMax = activeModel === ANTHROPIC_MAX_MODEL;

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
    ? isMax ? "Working..." : (activeStep?.label || ROTATING_PHRASES[phraseIndex])
    : isMax
      ? "Lex's Reasoning"
      : `${steps.filter((s) => s.status === "done").length} steps completed`;

  if (steps.length === 0 && !reasoningContent) return null;

  return (
    <div className={`mb-3 rounded-[var(--radius-sm)] border border-[var(--border)] text-sm ${isMax ? "bg-[var(--surface)]" : "bg-[var(--surface-muted)]"}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        {isStreaming ? (
          <div className={`h-3 w-3 shrink-0 rounded-full border-2 border-t-transparent animate-spin ${isMax ? "border-[var(--accent)]" : "border-[var(--accent)]"}`} />
        ) : (
          <div className={`h-3 w-3 shrink-0 rounded-full ${isMax ? "bg-[var(--accent)]" : "bg-[var(--accent)]"}`} />
        )}
        <span className={`flex-1 text-[13px] ${isMax ? "font-semibold" : "font-medium"}`}>{headerLabel}</span>
        {!isStreaming && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
          />
        )}
      </button>
      {(isOpen || isStreaming) && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          {isMax && reasoningContent && (
            <div className="mb-2 text-[12px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {reasoningContent}
            </div>
          )}
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
          {!isStreaming && isMax && typeof citationMatchCount === "number" && citationMatchCount > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
              <div className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
              Verified {citationMatchCount} citation{citationMatchCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
