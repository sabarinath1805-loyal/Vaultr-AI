"use client";

import React from "react";

export interface ReasoningStep {
  id: string;
  label: string;
  detail: string;
  pills?: string[];
  completed: boolean;
}

interface ReasoningTimelineProps {
  steps: ReasoningStep[];
  visible: boolean;
}

export function ReasoningTimeline({ steps, visible }: ReasoningTimelineProps) {
  if (steps.length === 0 || !visible) return null;

  return (
    <div
      className={`mb-4 transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      data-testid="reasoning-timeline"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = isLast && !step.completed;

        return (
          <div key={step.id} className="flex gap-2.5 pb-2.5">
            <div className="flex flex-col items-center pt-[3px]">
              {isActive ? (
                <span className="reasoning-spinner inline-block h-[14px] w-[14px]" />
              ) : (
                <span className="mt-[1px] inline-block h-[10px] w-[10px] rounded-full bg-[var(--text-primary)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-normal leading-tight text-[var(--text-primary)]">
                {step.label}
              </div>
              {step.detail && (
                <div className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
                  {step.detail}
                </div>
              )}
              {step.pills && step.pills.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.pills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-block rounded-full bg-[var(--surface)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function parseReasoningSteps(
  thinkContent: string | null,
  hasDocument: boolean,
  webSearchUsed: boolean,
  searchDomains: string[],
  isStreaming: boolean
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  const text = (thinkContent || "").toLowerCase();

  const hasAssess =
    text.includes("understand") ||
    text.includes("assess") ||
    text.includes("analyzing") ||
    text.includes("question") ||
    text.includes("query");
  const hasEvaluate =
    text.includes("evaluate") ||
    text.includes("consider") ||
    text.includes("review") ||
    text.includes("conclusion") ||
    text.includes("found");

  if (hasAssess || thinkContent) {
    const assessDetail = extractFirstSentence(thinkContent || "", [
      "understand",
      "assess",
      "question",
      "query",
      "asking",
      "want",
      "need",
    ]);
    steps.push({
      id: "assess",
      label: "Assessing query",
      detail: assessDetail || "Analyzing the legal question",
      completed: true,
    });
  }

  if (hasDocument) {
    steps.push({
      id: "document",
      label: "Reviewing document",
      detail: "",
      pills: ["Attached document"],
      completed: true,
    });
  }

  if (webSearchUsed) {
    steps.push({
      id: "search",
      label: "Searching sources",
      detail: "",
      pills: searchDomains.length > 0 ? searchDomains : ["Web search"],
      completed: true,
    });
  }

  if (hasEvaluate && thinkContent) {
    const evalDetail = extractFirstSentence(thinkContent, [
      "evaluate",
      "consider",
      "found",
      "conclusion",
      "result",
    ]);
    steps.push({
      id: "evaluate",
      label: "Evaluating response",
      detail: evalDetail || "Reviewing findings",
      completed: true,
    });
  }

  steps.push({
    id: "prepare",
    label: "Preparing answer",
    detail: "",
    completed: !isStreaming,
  });

  return steps;
}

function extractFirstSentence(
  text: string,
  keywords: string[]
): string {
  const sentences = text.split(/[.!?\n]/).filter((s) => s.trim().length > 10);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      const clean = sentence
        .replace(/<\/?think>/g, "")
        .replace(/[\r\n]+/g, " ")
        .trim();
      if (clean.length > 120) return clean.substring(0, 117) + "...";
      return clean;
    }
  }
  return "";
}
