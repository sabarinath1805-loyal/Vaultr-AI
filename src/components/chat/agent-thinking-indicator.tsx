"use client";

import React from "react";

const AGENT_STEPS = [
  "Analysing task...",
  "Searching legal databases...",
  "Fetching case law...",
  "Synthesising findings...",
  "Drafting response...",
];

interface AgentThinkingIndicatorProps {
  visible: boolean;
  /** Index of the current active step (0-based). */
  activeStepIndex: number;
}

export function AgentThinkingIndicator({
  visible,
  activeStepIndex,
}: AgentThinkingIndicatorProps) {
  return (
    <div
      className={`lex-thinking-indicator mb-3 flex flex-col gap-1.5 text-[var(--text-primary)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="agent-thinking-indicator"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-flex items-center justify-center"
          style={{
            fontSize: "24px",
            lineHeight: 1,
            width: "24px",
            height: "24px",
            color: "var(--text-primary)",
            fontWeight: 500,
          }}
        >
          ✳
        </span>
        <span
          style={{
            fontSize: "16px",
            lineHeight: "24px",
            marginLeft: "-2px",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Lex Agent
        </span>
        <span
          className="lex-thinking-dots"
          aria-hidden="true"
          style={{ lineHeight: "24px" }}
        >
          <span>●</span>
          <span>●</span>
          <span>●</span>
        </span>
      </div>
      <div className="ml-8 flex flex-col gap-1">
        {AGENT_STEPS.map((step, i) => {
          if (i > activeStepIndex) return null;
          const isActive = i === activeStepIndex;
          return (
            <div
              key={step}
              className="flex items-center gap-2 animate-message-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isActive
                    ? "bg-[var(--accent)] animate-pulse"
                    : "bg-[var(--text-muted)]"
                }`}
              />
              <span
                className="text-sm"
                style={{
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { AGENT_STEPS };
