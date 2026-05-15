"use client";

import type { ContractAnalysis, ContractRisk } from "@/lib/contract-scanner";
import { getRiskCounts, sortClausesByRisk } from "@/lib/contract-scanner";

interface ResultsDisplayProps {
  analysis: ContractAnalysis;
  onReset: () => void;
}

const riskClasses: Record<ContractRisk, { badge: string; border: string; text: string }> = {
  HIGH: {
    badge: "border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger-hover)]",
    border: "border-l-[var(--danger)]",
    text: "text-[var(--danger-hover)]",
  },
  MEDIUM: {
    badge: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
    border: "border-l-[var(--warning-border)]",
    text: "text-[var(--warning)]",
  },
  LOW: {
    badge: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
    border: "border-l-[var(--success-border)]",
    text: "text-[var(--success)]",
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
      <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] font-normal text-[var(--text)]">
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
              <h3 className="font-display text-[28px] font-normal text-[var(--text)]">
                {clause.title}
              </h3>
              <RiskBadge risk={clause.risk} />
            </div>
            <p className="mt-2 text-[13px] italic text-[var(--text-muted)]">
              “{clause.excerpt}”
            </p>
            <p className="mt-3 text-[13px] text-[var(--text)]">
              <span className="text-xs font-medium uppercase">Issue:</span>{" "}
              {clause.issue}
            </p>
            <p className="mt-2 text-[13px] italic text-[var(--text-muted)]">
              <span className="text-xs font-medium uppercase not-italic text-[var(--text)]">
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
