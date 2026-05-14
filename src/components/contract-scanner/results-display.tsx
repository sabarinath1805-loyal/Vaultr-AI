"use client";

import type { ContractAnalysis, ContractRisk } from "@/lib/contract-scanner";
import { getRiskCounts, sortClausesByRisk } from "@/lib/contract-scanner";

interface ResultsDisplayProps {
  analysis: ContractAnalysis;
  onReset: () => void;
}

const riskClasses: Record<ContractRisk, { badge: string; border: string; text: string }> = {
  HIGH: {
    badge: "border-[rgb(229,62,62)] bg-[rgb(255,240,240)] text-[rgb(197,48,48)]",
    border: "border-l-[rgb(229,62,62)]",
    text: "text-[rgb(197,48,48)]",
  },
  MEDIUM: {
    badge: "border-[rgb(214,158,46)] bg-[rgb(255,251,240)] text-[rgb(183,121,31)]",
    border: "border-l-[rgb(214,158,46)]",
    text: "text-[rgb(183,121,31)]",
  },
  LOW: {
    badge: "border-[rgb(56,161,105)] bg-[rgb(240,255,244)] text-[rgb(39,103,73)]",
    border: "border-l-[rgb(56,161,105)]",
    text: "text-[rgb(39,103,73)]",
  },
};

function RiskBadge({ risk, large = false }: { risk: ContractRisk; large?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border font-semibold uppercase ${riskClasses[risk].badge} ${
        large ? "px-4 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      {risk}
    </span>
  );
}

export function ResultsDisplay({ analysis, onReset }: ResultsDisplayProps) {
  const clauses = sortClausesByRisk(analysis.clauses);
  const counts = getRiskCounts(clauses);
  const reportText = [
    analysis.contract_title,
    `Parties: ${analysis.parties.join(", ")}`,
    `Overall risk: ${analysis.overall_risk}`,
    analysis.summary,
    ...clauses.map(
      (clause) =>
        `${clause.risk}: ${clause.title}\nIssue: ${clause.issue}\nRecommendation: ${clause.recommendation}`
    ),
  ].join("\n\n");

  return (
    <div className="space-y-5 px-6 pb-8">
      <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-[var(--text)]">
              {analysis.contract_title}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Between {analysis.parties.join(" and ")}
            </p>
          </div>
          <div className="shrink-0">
            <RiskBadge risk={analysis.overall_risk} large />
          </div>
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-[var(--text)]">
          {analysis.summary}
        </p>
      </article>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-[13px]">
        <span className={riskClasses.HIGH.text}>{counts.high} High</span>
        <span className="px-2 text-[var(--border)]">·</span>
        <span className={riskClasses.MEDIUM.text}>{counts.medium} Medium</span>
        <span className="px-2 text-[var(--border)]">·</span>
        <span className="text-[var(--text-muted)]">
          {counts.standard} Standard Clauses
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[background-color] duration-150 hover:bg-[var(--surface)]"
        >
          Scan another contract
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(reportText)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[background-color] duration-150 hover:bg-[var(--surface)]"
        >
          Copy report
        </button>
      </div>

      <div className="space-y-4">
        {clauses.map((clause) => (
          <article
            key={`${clause.title}-${clause.excerpt}`}
            className={`rounded-[var(--radius-md)] border border-l-4 border-[var(--border)] bg-[var(--bg)] px-6 py-5 ${riskClasses[clause.risk].border}`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                {clause.title}
              </h3>
              <RiskBadge risk={clause.risk} />
            </div>
            <p className="mt-2 text-[13px] italic text-[var(--text-muted)]">
              “{clause.excerpt}”
            </p>
            <p className="mt-3 text-[13px] text-[var(--text)]">
              <span className="text-xs font-semibold uppercase">Issue:</span>{" "}
              {clause.issue}
            </p>
            <p className="mt-2 text-[13px] italic text-[var(--text-muted)]">
              <span className="text-xs font-semibold uppercase not-italic text-[var(--text)]">
                Recommendation:
              </span>{" "}
              {clause.recommendation}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
