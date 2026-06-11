"use client";

import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

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

const AGENT_STEP_LABELS_DONE: Record<AgentStepId, string> = {
  parse: "Analysed query",
  matter: "Loaded matter context",
  search: "Searched legal databases",
  fetch: "Fetched case excerpts",
  tavily: "Ran web search",
  synthesise: "Synthesised sources",
  draft: "Drafted response",
};

const AGENT_STEP_LABELS_ACTIVE: Record<AgentStepId, string> = {
  parse: "Analysing query...",
  matter: "Loading matter context...",
  search: "Searching legal databases...",
  fetch: "Fetching case excerpts...",
  tavily: "Running web search...",
  synthesise: "Synthesising sources...",
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
    <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center"
          style={{
            fontSize: "20px",
            lineHeight: 1,
            width: "20px",
            height: "20px",
            color: "var(--text-primary)",
            fontWeight: 500,
          }}
        >
          ✳
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Lex Agent
        </span>
      </div>
      <div className="ml-7 flex flex-col gap-1">
        {AGENT_STEP_IDS.map((stepId) => {
          const isDone = completedSteps.includes(stepId);
          const isActive = stepId === currentStep && !isDone;

          if (!isDone && !isActive) return null;

          return (
            <div
              key={stepId}
              className="flex animate-message-in items-center gap-2"
            >
              {isDone ? (
                <CheckCircle2
                  size={14}
                  className="flex-shrink-0 text-green-600"
                  strokeWidth={2}
                />
              ) : (
                <Loader2
                  size={14}
                  className="flex-shrink-0 animate-spin text-[var(--accent)]"
                />
              )}
              <span
                className="text-[13px]"
                style={{
                  color: isDone ? "var(--text-muted)" : "var(--text-primary)",
                  fontWeight: isActive ? 500 : 400,
                  opacity: isDone ? 0.7 : 1,
                }}
              >
                {isDone
                  ? AGENT_STEP_LABELS_DONE[stepId]
                  : AGENT_STEP_LABELS_ACTIVE[stepId]}
              </span>
              {isActive && (
                <span className="text-xs tabular-nums text-[var(--text-faint)]">
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
