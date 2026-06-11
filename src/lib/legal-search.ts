// Legal database search service
// Queries real legal APIs + Tavily jurisdiction-scoped search in parallel

import { getConfiguredApiKey } from "./tauri-env";

/**
 * Sanitize a free-text search query to prevent injection into external legal APIs.
 */
function sanitizeSearchQuery(input: string, maxLength: number = 200): string {
  if (typeof input !== "string" || !input) return "";
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ""); // eslint-disable-line no-control-regex
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized.trim();
}

export interface LegalCase {
  title: string;
  citation: string;
  year: string;
  jurisdiction: string;
  court: string;
  summary: string;
  url: string;
  source: string;
}

export interface LegalSearchResult {
  cases: LegalCase[];
  databases_searched: string[];
  offline: boolean;
  wikiSummary?: string;
}

// ─── Real API sources (kept) ───────────────────────────────────────────────

// CourtListener (USA) — free REST API, no key needed
async function searchCourtListener(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&format=json&page_size=3&semantic=true`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).slice(0, 4).map((item: Record<string, unknown>) => ({
      title: (item.caseName as string) || "Unknown",
      citation: (item.citation as string) || "",
      year: item.dateFiled
        ? new Date(item.dateFiled as string).getFullYear().toString()
        : "",
      jurisdiction: "USA",
      court: (item.court as string) || "",
      summary: (item.snippet as string) || "",
      url: `https://www.courtlistener.com${(item.absolute_url as string) || ""}`,
      source: "CourtListener",
    }));
  } catch (error) {
    console.error("[legal-search] CourtListener failed:", error);
    return [];
  }
}

// Harvard Caselaw Access Project (USA)
async function searchCaseLaw(query: string): Promise<LegalCase[]> {
  try {
    const capApiKey = process.env.HARVARD_CAP_API_KEY;
    const headers: Record<string, string> = {};
    if (capApiKey) headers["Authorization"] = `Token ${capApiKey}`;
    const response = await fetch(
      `https://api.case.law/v1/cases/?search=${encodeURIComponent(query)}&page_size=3`,
      { signal: AbortSignal.timeout(3000), headers }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).slice(0, 3).map((item: Record<string, unknown>) => {
      const citations = item.citations as { cite: string }[] | undefined;
      const court = item.court as { name?: string } | undefined;
      const preview = item.preview as string[] | undefined;
      return {
        title: (item.name as string) || "Unknown",
        citation: citations?.[0]?.cite || "",
        year: item.decision_date
          ? (item.decision_date as string).split("-")[0]
          : "",
        jurisdiction: "USA",
        court: court?.name || "",
        summary: preview?.[0] || "",
        url: (item.url as string) || "",
        source: "Caselaw Access Project",
      };
    });
  } catch (error) {
    console.error("[legal-search] searchCaseLaw failed:", error);
    return [];
  }
}

// EUR-Lex (European Union) — free REST API
async function searchEurLex(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://eur-lex.europa.eu/search.html?qid=1&text=${encodeURIComponent(query)}&scope=EURLEX&type=quick&lang=en&andText0=&withinCorpus=EURLEX&DTS_SUBDOM=EU_CASE_LAW&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const results = (data.results as { result?: Record<string, unknown>[] })?.result;
    return (results || []).slice(0, 3).map((item: Record<string, unknown>) => {
      const title = item.title as { value?: string } | undefined;
      const reference = item.reference as { value?: string } | undefined;
      const date = item.date as { value?: string } | undefined;
      const excerpt = item.excerpt as { value?: string } | undefined;
      const link = item.link as { value?: string } | undefined;
      return {
        title: title?.value || "Unknown",
        citation: reference?.value || "",
        year: date?.value?.split("-")[0] || "",
        jurisdiction: "EU",
        court: "Court of Justice of the EU",
        summary: excerpt?.value || "",
        url: link?.value || "https://eur-lex.europa.eu",
        source: "EUR-Lex",
      };
    });
  } catch {
    return [];
  }
}

// Indian Kanoon (India) — free API
async function searchIndianKanoon(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://api.indiankanoon.org/search/?formInput=${encodeURIComponent(query)}&pagenum=0`,
      {
        method: "POST",
        headers: { Authorization: "Token " },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.docs || []).slice(0, 2).map((item: Record<string, unknown>) => ({
      title: (item.title as string) || "Unknown",
      citation: (item.citation as string) || "",
      year: item.publishdate
        ? (item.publishdate as string).split("-")[0]
        : "",
      jurisdiction: "India",
      court: (item.docsource as string) || "",
      summary: (item.headline as string) || "",
      url: `https://indiankanoon.org/doc/${item.tid}/`,
      source: "Indian Kanoon",
    }));
  } catch {
    return [];
  }
}

// ─── Tavily jurisdiction-scoped search functions ──────────────────────────

async function tavilyJurisdictionSearch(
  query: string,
  includeDomains: string[],
  jurisdictionLabel: string,
  sourceLabel: string
): Promise<LegalCase[]> {
  try {
    const apiKey = getConfiguredApiKey("TAVILY_API_KEY");
    if (!apiKey) return [];
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_domains: includeDomains,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((item: { title?: string; url?: string; content?: string }) => ({
      title: item.title || "Unknown",
      citation: "",
      year: item.title?.match(/\[(\d{4})\]/)?.[1] || item.title?.match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: jurisdictionLabel,
      court: "",
      summary: (item.content || "").slice(0, 300),
      url: item.url || "",
      source: sourceLabel,
    }));
  } catch {
    return [];
  }
}

async function searchSingaporeLaw(query: string): Promise<LegalCase[]> {
  return tavilyJurisdictionSearch(query, [
    "elitigation.sg", "sso.agc.gov.sg", "singaporelawwatch.sg", "lawnet.sg",
  ], "Singapore", "Singapore Law (Tavily)");
}

async function searchUKLaw(query: string): Promise<LegalCase[]> {
  return tavilyJurisdictionSearch(query, [
    "bailii.org", "legislation.gov.uk", "iclr.co.uk",
  ], "UK", "UK Law (Tavily)");
}

async function searchAULaw(query: string): Promise<LegalCase[]> {
  return tavilyJurisdictionSearch(query, [
    "austlii.edu.au", "legislation.gov.au", "fedcourt.gov.au",
  ], "Australia", "AU Law (Tavily)");
}

async function searchCALaw(query: string): Promise<LegalCase[]> {
  return tavilyJurisdictionSearch(query, [
    "canlii.org", "laws-lois.justice.gc.ca",
  ], "Canada", "CA Law (Tavily)");
}

// ─── Wikipedia summary (kept) ─────────────────────────────────────────────

async function fetchWikipediaSummary(query: string): Promise<string> {
  try {
    const conceptPatterns = /\b(?:doctrine|principle|rule|test|standard|theory|maxim|concept|statute|act)\b/i;
    if (!conceptPatterns.test(query)) return "";
    const searchTerms = query.replace(/\b(?:case|v\.?|vs?\.?)\b/gi, "").trim().split(/\s+/).slice(0, 4).join("_");
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerms)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return "";
    const data = await response.json();
    const extract = (data.extract as string) || "";
    if (!extract || extract.length < 50) return "";
    const tokens = extract.split(/\s+/);
    return tokens.slice(0, 300).join(" ");
  } catch {
    return "";
  }
}

// ─── Jurisdiction detection ───────────────────────────────────────────────

export const JURISDICTION_DB_PRIORITY: Record<string, string[]> = {
  us: ["courtlistener", "caselaw"],
  uk: ["uklaw_tavily", "courtlistener"],
  au: ["aulaw_tavily", "courtlistener"],
  sg: ["sglaw_tavily", "courtlistener"],
  eu: ["eurlex", "courtlistener"],
  in: ["indiankanoon", "courtlistener"],
  ca: ["calaw_tavily", "courtlistener"],
  int: ["courtlistener", "eurlex"],
};

function isLegalQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.split(/\s+/).length < 4) return false;
  const nonLegal = /^(?:hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no|great)\b/i;
  if (nonLegal.test(trimmed)) return false;
  return true;
}

const JURISDICTION_KEYWORDS: { pattern: RegExp; code: string }[] = [
  { pattern: /\b(?:corporations act|australia|australian|austlii|nsw|queensland|victoria|hca|fca)\b/i, code: "au" },
  { pattern: /\b(?:companies act.*singapore|singapore|singaporean|sgd|sghc|sgca|irda|mas|sgx)\b/i, code: "sg" },
  { pattern: /\b(?:uk\b|united kingdom|england|wales|ewca|ewhc|uksc|bailli|english law)\b/i, code: "uk" },
  { pattern: /\b(?:eu\b|european union|european|directive|regulation.*eu|eur-lex|ecj|cjeu)\b/i, code: "eu" },
  { pattern: /\b(?:india|indian|ipc|crpc|indian kanoon|supreme court of india|sc india|bombay|delhi high)\b/i, code: "in" },
  { pattern: /\b(?:us\b|united states|american|federal|circuit|scotus|ussc|usc §|delaware|new york)\b/i, code: "us" },
  { pattern: /\b(?:canada|canadian|scc|onca|bcca|ontario|alberta)\b/i, code: "ca" },
];

export function detectJurisdiction(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const { pattern, code } of JURISDICTION_KEYWORDS) {
    if (pattern.test(lower)) return code;
  }
  return undefined;
}

/**
 * Map jurisdiction prompt text to a jurisdiction code.
 */
export function parseJurisdictionCode(jurisdictionPrompt: string): string | undefined {
  const lower = (jurisdictionPrompt || "").toLowerCase();
  const map: Record<string, string> = {
    singapore: "sg",
    "united kingdom": "uk",
    australia: "au",
    "united states": "us",
    "european union": "eu",
    india: "in",
    canada: "ca",
  };
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code;
  }
  return undefined;
}

// ─── Cache ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, { result: LegalSearchResult; expiresAt: number }>();

function getCacheKey(query: string, jurisdiction?: string): string {
  return `${query.trim().toLowerCase()}|${(jurisdiction || "all").toLowerCase()}`;
}

function getCachedResult(query: string, jurisdiction?: string): LegalSearchResult | null {
  const key = getCacheKey(query, jurisdiction);
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResult(query: string, jurisdiction: string | undefined, result: LegalSearchResult): void {
  const key = getCacheKey(query, jurisdiction);
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  if (searchCache.size > CACHE_MAX_ENTRIES) {
    const now = Date.now();
    const survivors: Array<[string, { result: LegalSearchResult; expiresAt: number }]> = [];
    for (const [k, v] of searchCache) {
      if (now <= v.expiresAt) survivors.push([k, v]);
    }
    survivors.sort((a, b) => b[1].expiresAt - a[1].expiresAt);
    const kept = survivors.slice(0, CACHE_MAX_ENTRIES);
    searchCache.clear();
    for (const [k, v] of kept) searchCache.set(k, v);
  }
}

// ─── Main search function ─────────────────────────────────────────────────

export async function searchLegalDatabases(
  query: string,
  jurisdiction?: string
): Promise<LegalSearchResult> {
  const sanitizedQuery = sanitizeSearchQuery(query, 200);
  if (!sanitizedQuery) {
    return { cases: [], databases_searched: [], offline: false };
  }

  if (!isLegalQuery(sanitizedQuery)) {
    return { cases: [], databases_searched: [], offline: false };
  }

  const cached = getCachedResult(sanitizedQuery, jurisdiction);
  if (cached) return cached;

  const safeQuery = sanitizedQuery;

  const dbMap: Record<string, (q: string) => Promise<LegalCase[]>> = {
    courtlistener: searchCourtListener,
    caselaw: searchCaseLaw,
    eurlex: searchEurLex,
    indiankanoon: searchIndianKanoon,
    sglaw_tavily: searchSingaporeLaw,
    uklaw_tavily: searchUKLaw,
    aulaw_tavily: searchAULaw,
    calaw_tavily: searchCALaw,
  };
  const dbNames: Record<string, string> = {
    courtlistener: "CourtListener",
    caselaw: "Caselaw Access Project",
    eurlex: "EUR-Lex",
    indiankanoon: "Indian Kanoon",
    sglaw_tavily: "Singapore Law (Tavily)",
    uklaw_tavily: "UK Law (Tavily)",
    aulaw_tavily: "AU Law (Tavily)",
    calaw_tavily: "CA Law (Tavily)",
  };

  const detectedJurisdiction = detectJurisdiction(safeQuery) || jurisdiction;
  const priority = JURISDICTION_DB_PRIORITY[detectedJurisdiction || "all"] || [];

  const dbKeysToSearch = priority.length > 0
    ? priority.slice(0, 4)
    : ["sglaw_tavily", "courtlistener"];

  const wikiSummary = await fetchWikipediaSummary(safeQuery);

  const results = await Promise.race([
    Promise.allSettled(
      dbKeysToSearch.map((key) => dbMap[key]?.(safeQuery) ?? Promise.resolve([]))
    ),
    new Promise<PromiseSettledResult<LegalCase[]>[]>((_, reject) =>
      setTimeout(() => reject(new Error("RAG_TIMEOUT")), 4000)
    ),
  ]).catch(() => [] as PromiseSettledResult<LegalCase[]>[]);

  const allCases: LegalCase[] = [];
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    allCases.push(...result.value);
  });

  const seenUrls = new Set<string>();
  const scoredCases: (LegalCase & { _score: number })[] = [];
  for (const c of allCases) {
    if (!c) continue;
    const title = c.title || "";
    const caseJurisdiction = c.jurisdiction || "";

    if (c.url && seenUrls.has(c.url)) continue;
    if (c.url) seenUrls.add(c.url);

    let score = 0;
    const lowerQuery = safeQuery.toLowerCase();
    const lowerTitle = title.toLowerCase();
    if (lowerQuery.split(/\s+/).some((w) => w.length > 3 && lowerTitle.includes(w))) score += 3;
    if (detectedJurisdiction && caseJurisdiction.toLowerCase().includes(detectedJurisdiction)) score += 2;
    const year = c.year ? parseInt(c.year, 10) : 0;
    if (year && year >= new Date().getFullYear() - 10) score += 1;

    scoredCases.push({ ...c, _score: score });
  }
  scoredCases.sort((a, b) => b._score - a._score);
  const topCases = scoredCases.slice(0, 10).map(({ _score, ...rest }) => rest);

  const result = {
    cases: topCases,
    databases_searched: dbKeysToSearch.map((k) => dbNames[k] || k),
    offline: false,
    wikiSummary: wikiSummary || undefined,
  };

  if (topCases.length > 0) {
    setCachedResult(sanitizedQuery, jurisdiction, result);
  }

  return result;
}

/**
 * Smarter Tavily/web-search triggering: only fire when the query suggests
 * recency, current status, news, or when the RAG corpus came back empty.
 */
export function tavilyIsWarranted(message: string, ragResultCount: number = 0): boolean {
  const normalized = message.toLowerCase();

  // Date / recency signals
  const dateSignals = [
    /\brecent(ly)?\b/i,
    /\blatest\b/i,
    /\bcurrent(ly)?\b/i,
    /\b2024\b/,
    /\b2025\b/,
    /\b2026\b/,
    /\btoday\b/i,
    /\bthis (week|month|year)\b/i,
    /\bupdated\b/i,
    /\bnew(ly)?\b/i,
  ];
  if (dateSignals.some((pattern) => pattern.test(normalized))) return true;

  // News / regulatory development signals
  const newsSignals = [
    /\bnews\b/i,
    /\bannounce(ment|d|d)?\b/i,
    /\bregulator(?!y obligation)/i,
    /\b(enforcement|investigation|raid|probe|settlement)\b/i,
    /\b(latest|recent|current) (case|law|regulation|statute|rule|guidance|directive)\b/i,
    /\b(amend(ment|ed)?|repeal(led)?)\b/i,
  ];
  if (newsSignals.some((pattern) => pattern.test(normalized))) return true;

  // RAG returned too few cases — web search may fill the gap
  if (ragResultCount < 3) return true;

  return false;
}

// Format cases for injection into Lex's context window
export function formatCasesForContext(cases: LegalCase[], maxCases = 5): string {
  if (cases.length === 0) return "";
  const formatted = cases.slice(0, maxCases)
    .map(
      (c) =>
        `- ${c.title}${c.citation ? ` [${c.citation}]` : ""}${c.year ? ` (${c.year})` : ""} — ${c.jurisdiction}${c.summary ? `: ${c.summary.slice(0, 200)}` : ""}`
    )
    .join("\n");
  return `\n\nRELEVANT CASE LAW FROM LEGAL DATABASES (do not reproduce these search queries or database names in your response — cite cases naturally inline):\n${formatted}\n\nCite these cases in your response where relevant. Use the exact case names provided above.`;
}
