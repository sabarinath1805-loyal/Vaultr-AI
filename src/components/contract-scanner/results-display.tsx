"use client";

import { pdf } from "@react-pdf/renderer";
import type { ContractAnalysis, ContractRisk } from "@/lib/contract-scanner";
import { getRiskCounts, sortClausesByRisk } from "@/lib/contract-scanner";
import { ContractRiskReportPdf } from "@/components/contract-scanner/risk-report-pdf";

export type RiskFilter = "all" | "high" | "medium" | "standard";

interface ResultsDisplayProps {
  analysis: ContractAnalysis;
  onReset: () => void;
  activeFilter: RiskFilter;
  onFilterChange: (filter: RiskFilter) => void;
  filename?: string;
  reportDate?: string;
}

const riskClasses: Record<ContractRisk, { badge: string; border: string; text: string }> = {
  CRITICAL: {
    badge: "border-[#7f1d1d] bg-[#fef2f2] text-[#7f1d1d]",
    border: "border-l-[#7f1d1d]",
    text: "text-[#7f1d1d]",
  },
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

const filterClasses: Record<RiskFilter, { active: string; inactive: string }> = {
  all: {
    active: "border-[#1a1916] bg-[#1a1916] text-white",
    inactive: "border-[#1a1916] bg-transparent text-[#1a1916]",
  },
  high: {
    active: "border-[#A32D2D] bg-[#A32D2D] text-white",
    inactive: "border-[#A32D2D] bg-transparent text-[#A32D2D]",
  },
  medium: {
    active: "border-[#BA7517] bg-[#BA7517] text-white",
    inactive: "border-[#BA7517] bg-transparent text-[#BA7517]",
  },
  standard: {
    active: "border-[var(--text-muted)] bg-[var(--text-muted)] text-white",
    inactive: "border-[var(--text-muted)] bg-transparent text-[var(--text-muted)]",
  },
};

function normalizeRisk(risk: ContractRisk | undefined): ContractRisk {
  return risk && riskClasses[risk] ? risk : "LOW";
}

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

export function ResultsDisplay({
  analysis,
  onReset,
  activeFilter,
  onFilterChange,
  filename,
  reportDate,
}: ResultsDisplayProps) {
  const clauses = sortClausesByRisk(
    (Array.isArray(analysis.clauses) ? analysis.clauses : []).map((clause) => ({
      ...clause,
      risk: normalizeRisk(clause.risk),
      title: clause.title || "Clause",
      excerpt: clause.excerpt || "No excerpt returned.",
      issue: clause.issue || "No issue returned.",
      recommendation: clause.recommendation || "No recommendation returned.",
    }))
  );
  const parties = Array.isArray(analysis.parties) ? analysis.parties : [];
  const overallRisk = normalizeRisk(analysis.overall_risk);
  const title = analysis.contract_title || "Contract Analysis";
  const summary = analysis.summary || "No summary returned.";
  const filteredClauses = clauses.filter((clause) => {
    const risk = normalizeRisk(clause.risk);
    if (activeFilter === "all") return true;
    if (activeFilter === "high") return risk === "CRITICAL" || risk === "HIGH";
    if (activeFilter === "medium") return risk === "MEDIUM";
    return risk === "LOW";
  });
  const counts = getRiskCounts(clauses);
  const criticalCount = clauses.filter((clause) => normalizeRisk(clause.risk) === "CRITICAL").length;
  const downloadReportPdf = async () => {
    const blob = await pdf(
      <ContractRiskReportPdf
        analysis={{ ...analysis, clauses }}
        filename={filename || `${title}.pdf`}
        reportDate={reportDate || new Date().toISOString()}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "contract-risk-report"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 px-6 pb-8">
      <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-normal text-[var(--text)]">
              {title}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Between {parties.length > 0 ? parties.join(" and ") : "parties not identified"}
            </p>
          </div>
          <div className="shrink-0">
            <RiskBadge risk={overallRisk} large />
          </div>
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-[var(--text)]">
          {summary}
        </p>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-[13px]">
        <div>
          <span className={riskClasses.CRITICAL.text}>{criticalCount} Critical</span>
          <span className="px-2 text-[var(--border)]">·</span>
          <span className={riskClasses.HIGH.text}>{counts.high} High</span>
          <span className="px-2 text-[var(--border)]">·</span>
          <span className={riskClasses.MEDIUM.text}>{counts.medium} Medium</span>
          <span className="px-2 text-[var(--border)]">·</span>
          <span className="text-[var(--text-muted)]">
            {counts.standard} Standard Clauses
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "All" },
            { id: "high", label: "High" },
            { id: "medium", label: "Medium" },
            { id: "standard", label: "Standard" },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id as RiskFilter)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                activeFilter === filter.id
                  ? filterClasses[filter.id as RiskFilter].active
                  : filterClasses[filter.id as RiskFilter].inactive
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
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
          onClick={() => void downloadReportPdf()}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[background-color] duration-150 hover:bg-[var(--surface)]"
        >
          Download PDF
        </button>
      </div>

      <div className="space-y-4">
        {filteredClauses.map((clause) => {
          const risk = normalizeRisk(clause.risk);
          return (
          <article
            key={`${clause.title}-${clause.excerpt}`}
            className={`rounded-[var(--radius-md)] border border-l-4 border-[var(--border)] bg-[var(--bg)] px-6 py-5 ${riskClasses[risk].border}`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[28px] font-normal text-[var(--text)]">
                {clause.title}
              </h3>
              <RiskBadge risk={risk} />
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
          );
        })}
      </div>
    </div>
  );
}
