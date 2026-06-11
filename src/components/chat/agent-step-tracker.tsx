"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";

export const AGENT_STEP_IDS = [
  "parse",
  "matter",
  "search",
  "fetch",
  "tavily",
  "synthesise",
  "draft",
] as const;

export type AgentStepId = (typeof AGENT_STEP_IDS)[number];

const AGENT_STEP_LABELS: Record<AgentStepId, string> = {
  parse: "Understanding your goal...",
  matter: "Reading matter documents...",
  search: "Searching legal databases...",
  fetch: "Fetching case law...",
  tavily: "Running web search...",
  synthesise: "Synthesising findings...",
  draft: "Drafting response...",
};

interface AgentStepTrackerProps {
  currentStep: string;
  completedSteps: string[];
  elapsedSeconds: number;
}

export function AgentStepTracker({
  currentStep,
  completedSteps,
  elapsedSeconds,
}: AgentStepTrackerProps) {
  return (
    <div className="lex-thinking-indicator lex-thinking-visible mb-3 flex flex-col gap-1.5 text-[var(--text-primary)]">
      <div className="mb-1 flex items-center gap-2">
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
      </div>
      <div className="ml-8 flex flex-col gap-1">
        {AGENT_STEP_IDS.map((stepId) => {
          const isDone = completedSteps.includes(stepId);
          const isActive = stepId === currentStep && !isDone;
          const isPending = !isDone && !isActive;

          if (isPending) return null;

          return (
            <div
              key={stepId}
              className="flex animate-message-in items-center gap-2"
            >
              {isDone ? (
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-green-500" strokeWidth={2.5} />
                </span>
              ) : isActive ? (
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                </span>
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" />
                </span>
              )}
              <span
                className="text-sm"
                style={{
                  color: isActive
                    ? "var(--text-primary)"
                    : isDone
                      ? "var(--text-muted)"
                      : "var(--text-faint)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {AGENT_STEP_LABELS[stepId]}
              </span>
              {isActive && (
                <span className="text-xs text-[var(--text-faint)]">
                  {elapsedSeconds}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
