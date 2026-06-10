import { getConfiguredApiKey } from "@/lib/tauri-env";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
}

/**
 * Resolve a legal citation (e.g. "Donoghue v Stevenson [1932] AC 562") into a snippet of the underlying judgment via the Tavily web search API.
 *
 * @param citation - Free-form citation string. Appended to " full judgment Singapore law" server-side.
 * @returns Up to 2000 characters of judgment text, or null if Tavily returns no usable content, the TAVILY_API_KEY is missing, or the request fails.
 */
export async function resolveCitation(citation: string): Promise<string | null> {
  const apiKey = getConfiguredApiKey("TAVILY_API_KEY");
  if (!apiKey?.trim()) return null;

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query: `${citation} full judgment Singapore law`,
        search_depth: "advanced",
        include_raw_content: true,
        max_results: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data: TavilyResponse = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    const text = result.raw_content || result.content || "";
    if (!text || text.length < 50) return null;

    return text.slice(0, 2000);
  } catch {
    console.warn(`[Citation Resolver] Failed to resolve: ${citation}`);
    return null;
  }
}

const CASE_FOLLOW_UP_PATTERNS = [
  /tell me more about (.+)/i,
  /what did the court say in (.+)/i,
  /expand on (.+)/i,
  /what happened in (.+)/i,
  /more detail on (.+)/i,
  /explain (.+?) (?:case|judgment|decision)/i,
  /can you elaborate on (.+)/i,
];

/**
 * Detect whether a user message is a follow-up question about a previously cited case (e.g. "tell me more about Donoghue v Stevenson").
 *
 * @param userMessage - The raw user-typed message.
 * @returns The extracted case name / subject (without surrounding quotes or trailing punctuation) if the message matches a known follow-up pattern, otherwise null.
 */
export function detectCaseFollowUp(userMessage: string): string | null {
  const trimmed = userMessage.trim().replace(/[?.!]+$/, "");
  for (const pattern of CASE_FOLLOW_UP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

// -------------------- Jurisdiction-aware citation resolution --------------------

/**
 * Heuristically classify a free-form citation string into a jurisdiction code.
 * Detects Singapore (SSO codes like "PDPA", "SFA", "Companies Act"), UK, Australia, US, EU,
 * and falls back to case-name signals (v., [YYYY]).
 */
export function detectCitationJurisdiction(citation: string): "sg" | "uk" | "au" | "us" | "eu" | null {
  const c = citation.toLowerCase();

  // Singapore Act codes / statutes
  if (/\b(pdpa|sfa|cma|sso|bpfp|civil law act|criminal procedure code|companies act|employment act)\b/.test(c)) {
    return "sg";
  }
  // Singapore case reporters
  if (/\b(sgca|sghc|sgdc|slr|sgx)\b/.test(c)) return "sg";

  // UK
  if (/\b(ewca|ewhc|uksc|ukhl|wlr|ac\b|hansard)\b/.test(c)) return "uk";
  if (/\b(united kingdom|england|wales|uk)\b/.test(c) && /\b(act|case|judgment)\b/.test(c)) return "uk";

  // Australia
  if (/\b(hca|fca|nswca|vsc|qca|nsw|victoria|australia|commonwealth)\b/.test(c)) return "au";
  if (/\b(austlii)\b/.test(c)) return "au";

  // US
  if (/\b(scotus|ussc|f\.\s*2d|f\.\s*3d|f\.\s*supp|u\.s\.|cornell|usc)\b/.test(c)) return "us";
  if (/\b(united states|us code|u\.s\.c\.)\b/.test(c)) return "us";

  // EU
  if (/\b(cjeu|ecj|eur-lex|tfeu|teu|directive \d{4}\/\d+\/ec|regulation \d{4}\/\d+)\b/.test(c)) return "eu";

  return null;
}

interface ParsedActCitation {
  jurisdiction: "sg" | "uk" | "au" | "us" | "eu";
  act: string;
  actCode?: string;
  section?: string;
  subsection?: string;
}

/**
 * Extract a structured Act + section reference from common citation forms:
 *  - "Personal Data Protection Act 2012, s.13"
 *  - "Companies Act s.216"
 *  - "PDPA s.13"
 *  - "Section 13 of the PDPA"
 *  - "ss 13, 14 of the Companies Act"
 */
export function parseActCitation(text: string): ParsedActCitation | null {
  const c = text.trim();
  const lower = c.toLowerCase();

  // 1. Statute + section
  const m1 = c.match(/(?:^|\b)([\w\s'&\-,.]+?(?:Act|Code|Ordinance|Regulation|Rules|Law))\s*(?:\d{4})?\s*,?\s*(?:s\.|section|ss\.?)?\s*(\d+[A-Za-z]?)(?:\s*\(([0-9A-Za-z]+)\))?/i);
  if (m1) {
    const actName = m1[1].trim();
    const act = normalizeActName(actName);
    const section = m1[2];
    const subsection = m1[3];
    const jurisdiction = detectActJurisdiction(actName) || detectCitationJurisdiction(c) || "sg";
    return { jurisdiction, act, section, subsection };
  }

  // 2. Short form: "PDPA s.13" or "SFA s.123"
  const m2 = c.match(/^([A-Z]{2,6})\s*s\.?\s*(\d+[A-Za-z]?)(?:\s*\(([0-9A-Za-z]+)\))?$/);
  if (m2) {
    const code = m2[1];
    const section = m2[2];
    const subsection = m2[3];
    const act = shortCodeToActName(code);
    const jurisdiction = act ? (detectActJurisdiction(act) || "sg") : "sg";
    return { jurisdiction, act, actCode: code, section, subsection };
  }

  // 3. "Section 13 of the Personal Data Protection Act"
  const m3 = c.match(/^Section\s+(\d+[A-Za-z]?)\s+of\s+the\s+([\w\s'&\-,.]+?(?:Act|Code|Ordinance|Regulation|Rules|Law))/i);
  if (m3) {
    const section = m3[1];
    const act = normalizeActName(m3[2]);
    const jurisdiction = detectActJurisdiction(m3[2]) || "sg";
    return { jurisdiction, act, section };
  }

  return null;
}

function normalizeActName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function detectActJurisdiction(actName: string): "sg" | "uk" | "au" | "us" | "eu" | null {
  const a = actName.toLowerCase();
  // Singapore
  if (/\b(personal data protection|companies act|employment act|civil law act|criminal procedure|criminal code)\b/.test(a)) return "sg";
  // UK
  if (/\b(companies act 2006|unfair contract terms|data protection act 2018|equality act 2010|human rights act)\b/.test(a)) return "uk";
  if (/(?:^|\s)(uk|united kingdom|england|wales)(\s|$)/.test(a)) return "uk";
  // Australia
  if (/\b(corporations act|fair work act|privacy act 1988|commonwealth)\b/.test(a)) return "au";
  // US
  if (/\b(uniform commercial code|usc|united states code|securities act|securities exchange)\b/.test(a)) return "us";
  return null;
}

function shortCodeToActName(code: string): string {
  const map: Record<string, string> = {
    PDPA: "Personal Data Protection Act 2012",
    SFA: "Securities and Futures Act 2001",
    CMA: "Capital Markets Services Act",
    BPFP: "Banking Act",
    CA: "Companies Act",
  };
  return map[code.toUpperCase()] || code;
}

/**
 * Build a Singapore Statutes Online (SSO) deep link for an Act + section.
 * The Act code is the kebab-cased suffix used by sso.agc.gov.sg.
 */
function buildSingaporeStatuteUrl(actName: string, section?: string, actCode?: string): string | null {
  let code = actCode;
  if (!code) {
    const upper = actName.toUpperCase();
    if (upper.includes("PERSONAL DATA PROTECTION")) code = "PDPA2012";
    else if (upper.includes("SECURITIES AND FUTURES")) code = "SFA2001";
    else if (upper.includes("COMPANIES ACT")) code = "CA1967";
    else if (upper.includes("EMPLOYMENT ACT")) code = "EmA1959";
    else if (upper.includes("CIVIL LAW ACT")) code = "CLA1909";
    else if (upper.includes("CRIMINAL PROCEDURE CODE")) code = "CPC2010";
    else if (upper.includes("PENAL CODE")) code = "PC1871";
  }
  if (!code) return null;
  if (section) {
    return `https://sso.agc.gov.sg/Act/${code}?Prov=${section}&ViewType=Pdf`;
  }
  return `https://sso.agc.gov.sg/Act/${code}`;
}

/**
 * Build a jurisdiction-appropriate search/canonical link for a citation.
 * Returns:
 *  - Direct SSO deep-link for Singapore statutes (when parseable)
 *  - Legislation portal search URLs for UK / AU / US / EU statutes
 *  - Court reporter / aggregator URLs for case citations
 *  - Google search fallback (with rich context) when jurisdiction is unknown
 */
export function buildCitationSearchUrl(
  citation: string,
  context?: { jurisdiction?: string; actName?: string; caseName?: string }
): string {
  const text = citation.trim();
  const lower = text.toLowerCase();
  const inferredJurisdiction =
    context?.jurisdiction ||
    detectCitationJurisdiction(text) ||
    "sg";

  // ----- Statute references -----
  const parsedAct = parseActCitation(text);
  if (parsedAct) {
    const { jurisdiction, act, section } = parsedAct;
    if (jurisdiction === "sg" && section) {
      const direct = buildSingaporeStatuteUrl(act, section, parsedAct.actCode);
      if (direct) return direct;
    }
    if (jurisdiction === "uk" && section) {
      return `https://www.legislation.gov.uk/search?text=${encodeURIComponent(`${act} section ${section}`)}`;
    }
    if (jurisdiction === "au" && section) {
      return `https://www.legislation.gov.au/Browse/ByTitle/Acts/InForce/?query=${encodeURIComponent(`${act} section ${section}`)}`;
    }
    if (jurisdiction === "us" && section) {
      const titleGuess = inferUSTitle(act, section);
      if (titleGuess) {
        return `https://www.law.cornell.edu/uscode/text/${titleGuess.sectionSlug}`;
      }
      return `https://www.law.cornell.edu/uscode/search/circular?q=${encodeURIComponent(`${act} section ${section}`)}`;
    }
    if (jurisdiction === "eu") {
      return `https://eur-lex.europa.eu/search.html?text=${encodeURIComponent(`${act} ${section}`)}`;
    }
  }

  // ----- Case citations -----
  const isCaseCitation =
    / v\.? /.test(lower) ||
    /\[\d{4}\]\s*[A-Z]{2,}/.test(text) ||
    /(\d+)\s+[A-Z]{2,}\s+\d+/.test(text);

  if (isCaseCitation) {
    if (inferredJurisdiction === "sg") {
      return `https://www.elitigation.sg/gdsearch/?search=${encodeURIComponent(text)}`;
    }
    if (inferredJurisdiction === "uk") {
      return `https://www.bailii.org/search?query=${encodeURIComponent(text)}`;
    }
    if (inferredJurisdiction === "au") {
      return `https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?query=${encodeURIComponent(text)}`;
    }
    if (inferredJurisdiction === "us") {
      return `https://www.courtlistener.com/?q=${encodeURIComponent(text)}&type=o&order_by=score+desc`;
    }
    if (inferredJurisdiction === "eu") {
      return `https://eur-lex.europa.eu/search.html?text=${encodeURIComponent(text)}&scope=EURLEX&type=quick`;
    }
  }

  // ----- Fallback: rich Google search using the act + jurisdiction -----
  const richQuery = context?.actName
    ? `${context.actName} ${text} ${inferredJurisdiction.toUpperCase()} law`
    : `${text} ${inferredJurisdiction.toUpperCase()} law`;
  return `https://www.google.com/search?q=${encodeURIComponent(richQuery)}`;
}

function inferUSTitle(act: string, _section: string): { sectionSlug: string } | null {
  const a = act.toLowerCase();
  if (/securities exchange/.test(a)) return { sectionSlug: "15" };
  if (/securities act of 1933/.test(a)) return { sectionSlug: "15" };
  if (/uniform commercial code/.test(a)) return { sectionSlug: "" };
  if (/civil rights/.test(a)) return { sectionSlug: "42" };
  if (/copyright/.test(a)) return { sectionSlug: "17" };
  if (/patent/.test(a)) return { sectionSlug: "35" };
  if (/trademark/.test(a)) return { sectionSlug: "15" };
  return null;
}