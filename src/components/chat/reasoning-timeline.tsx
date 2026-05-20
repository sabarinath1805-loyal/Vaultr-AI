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
  collapsed: boolean;
  showCollapsedIndicator?: boolean;
  onToggleCollapse: () => void;
}

export function ReasoningTimeline({
  steps,
  visible,
  collapsed,
  showCollapsedIndicator = false,
  onToggleCollapse,
}: ReasoningTimelineProps) {
  const [visibleCount, setVisibleCount] = React.useState(1);
  const stepKey = steps.map((step) => step.id).join("|");

  React.useEffect(() => {
    setVisibleCount(1);
  }, [stepKey]);

  React.useEffect(() => {
    if (!visible || collapsed || visibleCount >= steps.length) return;
    const timeout = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, steps.length));
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [collapsed, steps.length, visible, visibleCount]);

  if (steps.length === 0) return null;

  const collapsedButton = (
    <button
      type="button"
      onClick={onToggleCollapse}
      className="mb-2 flex items-center gap-1 text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      data-testid="reasoning-collapsed-toggle"
    >
      <span className="reasoning-gear-icon">⚙</span> Lex reasoned{" "}
      <span className="text-[10px]">▾</span>
    </button>
  );

  if (collapsed) {
    return collapsedButton;
  }

  const renderedSteps = steps.slice(0, visible ? visibleCount : steps.length);

  return (
    <>
      {showCollapsedIndicator && collapsedButton}
      <div
        className={`reasoning-timeline-container mb-4 pl-4 ${
          visible
            ? "reasoning-timeline-visible"
            : "reasoning-timeline-hidden"
        }`}
        data-testid="reasoning-timeline"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mb-3 flex items-center gap-1 text-[13px] text-[var(--text-muted)]"
        >
          Working...{" "}
          <span className="text-[10px]">▾</span>
        </button>
        {renderedSteps.map((step) => {
          const isActive = !step.completed;
          return (
            <div key={step.id} className="flex gap-2.5 pb-4">
              <div className="flex flex-col items-center pt-[3px]">
                {isActive ? (
                  <span className="reasoning-spinner inline-block h-[12px] w-[12px]" />
                ) : (
                  <span className="mt-[1px] inline-block h-[8px] w-[8px] rounded-full border border-[var(--text-muted)]" />
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
                        className="inline-block rounded bg-[var(--bg-secondary)] px-2 py-[3px] text-[12px] text-[var(--text-secondary)]"
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
    </>
  );
}

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

export function parseReasoningSteps(
  thinkContent: string | null,
  hasDocument: boolean,
  documentFilenames: string[],
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
      label: "Reviewing attached file",
      detail: "",
      pills: documentFilenames.length > 0 ? documentFilenames : ["Attached document"],
      completed: true,
    });
  }

  if (hasDocument && thinkContent) {
    const legalTerms = extractLegalTerms(thinkContent);
    if (legalTerms.length > 0) {
      steps.push({
        id: "terms",
        label: "Checking for terms in attached file",
        detail: "",
        pills: legalTerms,
        completed: true,
      });
    }
  }

  if (webSearchUsed) {
    steps.push({
      id: "search",
      label: "Searching the web for relevant information",
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
      "synthesiz",
    ]);
    steps.push({
      id: "evaluate",
      label: "Evaluating findings",
      detail: evalDetail || "Synthesizing case law and statutory provisions",
      completed: true,
    });
  }

  steps.push({
    id: "prepare",
    label: "Preparing response",
    detail: "",
    completed: !isStreaming,
  });

  return steps;
}

function extractLegalTerms(text: string): string[] {
  const legalKeywords = [
    "breach", "liability", "damages", "termination", "notice",
    "indemnity", "warranty", "negligence", "jurisdiction", "arbitration",
    "confidentiality", "force majeure", "obligation", "compliance",
    "fiduciary", "misrepresentation", "injunction", "tort", "statute",
    "consideration", "contract", "duty of care", "estoppel",
  ];
  const lower = text.toLowerCase();
  const found = legalKeywords.filter((kw) => lower.includes(kw));
  return found.slice(0, 8);
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
