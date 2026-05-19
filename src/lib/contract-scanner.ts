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

export function patchPredatoryClauseFindings(text: string, analysis: unknown) {
  if (!isRecord(analysis)) return analysis;
  const lowerText = text.toLowerCase();
  const clauses = Array.isArray(analysis.clauses) ? [...analysis.clauses] : [];

  const ensureClause = (
    pattern: RegExp,
    marker: string,
    clause: Record<string, string>
  ) => {
    if (!pattern.test(lowerText)) return;
    const alreadyFlagged = clauses.some((item) => {
      if (!isRecord(item)) return false;
      const title = typeof item.title === "string" ? item.title : "";
      const excerpt = typeof item.excerpt === "string" ? item.excerpt : "";
      const issue = typeof item.issue === "string" ? item.issue : "";
      const haystack = `${title} ${excerpt} ${issue}`.toLowerCase();
      return haystack.includes(marker) || haystack.includes(clause.title.toLowerCase());
    });
    if (!alreadyFlagged) clauses.unshift(clause);
  };

  ensureClause(
    /(independent legal advice|legal advice|seek counsel|consult counsel|solicitor|attorney)/,
    "independent legal advice",
    {
      title: "Restriction on independent legal advice",
      excerpt: "Clause restricts a party from seeking independent legal advice.",
      risk: "CRITICAL",
      issue: "A clause preventing independent legal advice interferes with informed consent and should be treated as the highest priority risk.",
      recommendation: "Delete the restriction entirely and preserve an express right for each party to seek independent legal advice.",
    }
  );
  ensureClause(
    /(unilateral(ly)? amend|amend.*notice alone|modify.*sole discretion|change any term|change.*terms.*notice)/,
    "unilateral amendment",
    {
      title: "Unilateral amendment rights",
      excerpt: "One party can change terms without negotiated consent.",
      risk: "HIGH",
      issue: "One party can amend terms by notice alone, leaving the other side bound without negotiated consent.",
      recommendation: "Require written mutual agreement for any amendment.",
    }
  );
  ensureClause(
    /(arbitration.*costs?.*(regardless of outcome|all costs|solely responsible)|all arbitration costs|bears.*arbitration)/,
    "arbitration costs",
    {
      title: "One-sided arbitration costs",
      excerpt: "One party bears arbitration costs regardless of outcome.",
      risk: "HIGH",
      issue: "One party bears arbitration costs regardless of outcome, creating one-sided dispute economics.",
      recommendation: "Use tribunal discretion or loser-pays allocation instead of a fixed one-sided cost burden.",
    }
  );

  return { ...analysis, clauses };
}

export function parseContractAnalysisJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sortClausesByRisk(clauses: ContractClause[]) {
  return [...clauses].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
}

export function getRiskCounts(clauses: ContractClause[]) {
  const high = clauses.filter((clause) => clause.risk === "HIGH").length;
  const medium = clauses.filter((clause) => clause.risk === "MEDIUM").length;
  const low = clauses.filter((clause) => clause.risk === "LOW").length;

  return { high, medium, low, standard: low };
}
