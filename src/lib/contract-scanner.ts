export type ContractRisk = "HIGH" | "MEDIUM" | "LOW";

export interface ContractClause {
  title: string;
  excerpt: string;
  risk: ContractRisk;
  issue: string;
  recommendation: string;
}

export interface ContractAnalysis {
  contract_title: string;
  parties: string[];
  summary: string;
  overall_risk: ContractRisk;
  clauses: ContractClause[];
}

export const CONTRACT_ANALYSIS_PROMPT = `You are Lex, a senior commercial lawyer. Analyze the following contract and
return a JSON response with this exact structure:

{
  "contract_title": "string — inferred title or document type",
  "parties": ["string array of party names"],
  "summary": "string — 2-3 sentence plain English summary",
  "overall_risk": "HIGH | MEDIUM | LOW",
  "clauses": [
    {
      "title": "string — clause name",
      "excerpt": "string — relevant quote from contract, max 200 chars",
      "risk": "HIGH | MEDIUM | LOW",
      "issue": "string — plain English explanation of the problem",
      "recommendation": "string — specific negotiation recommendation"
    }
  ]
}

Return ONLY valid JSON. No preamble, no explanation, no markdown.
Analyze every significant clause. Flag at minimum: limitation of liability,
indemnification, termination rights, payment terms, IP ownership,
non-compete/non-solicit, governing law, dispute resolution, auto-renewal,
confidentiality scope.

CONTRACT TEXT:
{contract_text}`;

export const RISK_ORDER: Record<ContractRisk, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export function sortClausesByRisk(clauses: ContractClause[]) {
  return [...clauses].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
}

export function getRiskCounts(clauses: ContractClause[]) {
  const high = clauses.filter((clause) => clause.risk === "HIGH").length;
  const medium = clauses.filter((clause) => clause.risk === "MEDIUM").length;
  const low = clauses.filter((clause) => clause.risk === "LOW").length;

  return { high, medium, low, standard: low };
}
