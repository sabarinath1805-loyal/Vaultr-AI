export type ContractRisk = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

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
  "overall_risk": "CRITICAL | HIGH | MEDIUM | LOW",
  "clauses": [
    {
      "title": "string — clause name",
      "excerpt": "string — relevant quote from contract, max 200 chars",
      "risk": "CRITICAL | HIGH | MEDIUM | LOW",
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

Pay special attention to these commonly missed predatory clauses:

1. Any clause preventing a party from seeking independent legal advice — flag as CRITICAL, highest priority
2. Unilateral amendment rights — one party can change any term by notice alone — flag as HIGH
3. One-sided arbitration costs — one party always bears all costs regardless of outcome — flag as HIGH
4. Clauses binding successors, heirs, or assigns without consent
5. Perpetual post-termination obligations surviving indefinitely
6. Data or IP rights granted to one party over the other's own business data or internal operations

CONTRACT TEXT:
{contract_text}`;

export const RISK_ORDER: Record<ContractRisk, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
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
