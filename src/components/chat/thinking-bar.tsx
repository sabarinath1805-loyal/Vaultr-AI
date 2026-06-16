"use client";

import React, { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

interface ThinkingBarProps {
  /**
   * Whether Lex is still generating. When false, the bar is not rendered
   * at all (it disappears once the response is complete).
   */
  visible: boolean;
  /**
   * Optional raw reasoning text. When present and the user expands the
   * bar, this text is shown verbatim. When absent the expanded panel
   * shows a placeholder so the bar still indicates where the reasoning
   * would go.
   */
  reasoningContent?: string;
  /**
   * Optional active-model metadata so the label can call out the tier
   * (e.g. "Lex Max is thinking…").
   */
  activeModelLabel?: string;
  /**
   * Override the default header label. Defaults to "Lex is thinking…".
   */
  label?: string;
  /**
   * Show a small animated indicator that Lex is mid-stream. Defaults to
   * true — pass false to render the bar in a static "done thinking"
   * state.
   */
  isActive?: boolean;
}

/**
 * Single collapsible "Lex is thinking…" bar.
 *
 * Replaces the old 7-step `AgentStepTracker` and the 4-step inline
 * `ThinkingProcess` (Detecting jurisdiction / Searching legal databases /
 * Running web search / Synthesising response). The bar shows the Vaultr
 * asterism prominently, animates while Lex is mid-stream, and expands
 * on click to reveal the raw reasoning content. Collapses by default.
 */
export function ThinkingBar({
  visible,
  reasoningContent,
  activeModelLabel,
  label,
  isActive = true,
}: ThinkingBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!visible) return null;

  const trimmedReasoning = reasoningContent?.trim() ?? "";
  const headerLabel =
    label ??
    (activeModelLabel
      ? `${activeModelLabel} is thinking…`
      : "Lex is thinking…");

  return (
    <div
      className="lex-thinking-bar mb-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]"
      data-testid="lex-thinking-bar"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="lex-thinking-bar-panel"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-muted)]"
      >
        {isActive ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent)]"
            aria-hidden="true"
          />
        ) : (
          <div
            className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
            aria-hidden="true"
          />
        )}
        <span
          className="inline-flex shrink-0 items-center justify-center text-[var(--accent)]"
          style={{
            fontSize: "22px",
            lineHeight: 1,
            fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
            fontWeight: 400,
          }}
          aria-hidden="true"
        >
          ⁂
        </span>
        <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)]">
          {headerLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          }`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div
          id="lex-thinking-bar-panel"
          className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
        >
          {trimmedReasoning ? (
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {trimmedReasoning}
            </pre>
          ) : (
            <p className="m-0 text-[12px] leading-relaxed text-[var(--text-muted)]">
              Reasoning is not available for this response.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
