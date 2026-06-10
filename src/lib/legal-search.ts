// Legal database search service
// Queries multiple legal databases in parallel and returns relevant cases

/**
 * Sanitize a free-text search query to prevent injection into external legal APIs.
 *
 * @param input - The raw user-supplied search string. Non-string or empty values yield "".
 * @param maxLength - Maximum allowed length in characters. Defaults to 200.
 * @returns Sanitized string with control characters removed, length capped, and trimmed.
 *          Returns "" for non-string or empty input.
 */
function sanitizeSearchQuery(input: string, maxLength: number = 200): string {
  if (typeof input !== "string" || !input) return "";

  // Remove control characters
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Limit length
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

/**
 * Extract 3-5 key legal search terms from a natural-language user message using Groq's Llama 3.3 70B.
 * Falls back to returning the original message unchanged if the API call fails or no key is configured.
 *
 * @param userMessage - The user's raw natural-language query.
 * @returns A short search phrase (under ~10 words) suitable for legal database queries.
 *          Returns the original `userMessage` on any error or when `GROQ_API_KEY` is missing.
 */
async function extractLegalQuery(userMessage: string): Promise<string> {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return userMessage;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Extract 3-5 key legal search terms from this query. Return ONLY the search terms as a short phrase, nothing else. Focus on legal concepts, jurisdiction, and cause of action.",
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return userMessage;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || userMessage;
  } catch (error) {
    console.error(`[legal-search] extractLegalQuery failed for query: "${userMessage.slice(0, 100)}"`, error);
    return userMessage;
  }
}

// Detect if we're offline
async function isOnline(): Promise<boolean> {
  try {
    await fetch("https://www.google.com", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

// CourtListener (USA) — free REST API, no key needed
async function searchCourtListener(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&format=json&page_size=3&semantic=true`,
      { signal: AbortSignal.timeout(8000) }
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
    console.error(`[legal-search] CourtListener failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// Harvard Caselaw Access Project (USA) — free API (key optional for higher rate limits)
async function searchCaseLaw(query: string): Promise<LegalCase[]> {
  try {
    const capApiKey = process.env.HARVARD_CAP_API_KEY;
    const headers: Record<string, string> = {};
    if (capApiKey) headers["Authorization"] = `Token ${capApiKey}`;
    const response = await fetch(
      `https://api.case.law/v1/cases/?search=${encodeURIComponent(query)}&page_size=3`,
      { signal: AbortSignal.timeout(8000), headers }
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
    console.error(`[legal-search] searchCaseLaw failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// EUR-Lex (European Union) — free REST API
async function searchEurLex(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://eur-lex.europa.eu/search.html?qid=1&text=${encodeURIComponent(query)}&scope=EURLEX&type=quick&lang=en&andText0=&withinCorpus=EURLEX&DTS_SUBDOM=EU_CASE_LAW&format=json`,
      { signal: AbortSignal.timeout(8000) }
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
        signal: AbortSignal.timeout(8000),
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

// BAILII (UK + Ireland) — web scraping
async function searchBAILII(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.bailii.org/cgi-bin/lucy_search_1.pl?query=${encodeURIComponent(query)}&method=boolean&mask_path=&format=`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a href="(\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/g),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "UK",
      court: "",
      summary: "",
      url: `https://www.bailii.org${match[1]}`,
      source: "BAILII",
    }));
  } catch {
    return [];
  }
}

// AustLII (Australia) — web scraping
async function searchAustLII(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?method=boolean&query=${encodeURIComponent(query)}&results=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(
        /<a href="(\/au\/cases\/[^"]+)"[^>]*>([^<]+)<\/a>/g
      ),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "Australia",
      court: "",
      summary: "",
      url: `https://www.austlii.edu.au${match[1]}`,
      source: "AustLII",
    }));
  } catch {
    return [];
  }
}

// CommonLII (Commonwealth) — web scraping
async function searchCommonLII(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.commonlii.org/cgi-bin/sinosrch.cgi?method=boolean&query=${encodeURIComponent(query)}&results=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+v[^<]+)<\/a>/g),
    ];
    return matches.slice(0, 2).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "Commonwealth",
      court: "",
      summary: "",
      url: match[1].startsWith("http")
        ? match[1]
        : `https://www.commonlii.org${match[1]}`,
      source: "CommonLII",
    }));
  } catch {
    return [];
  }
}

// Singapore Law Watch — case summaries and updates
async function searchSingaporeLawWatch(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.singaporelawwatch.sg/portals/0/web/search/siteSearchResults?query=${encodeURIComponent(query)}&sort=relevance`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a[^>]+href="([^"]*\/[^"]+\/[^"]+)"[^>]*>([^<]{8,200})<\/a>/g),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: "Singapore",
      court: "Singapore Courts",
      summary: "",
      url: match[1].startsWith("http") ? match[1] : `https://www.singaporelawwatch.sg${match[1]}`,
      source: "Singapore Law Watch",
    }));
  } catch (error) {
    console.error(`[legal-search] SingaporeLawWatch failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// ICLR (Incorporated Council of Law Reporting) — UK law reports
async function searchICLR(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.iclr.co.uk/search/?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a[^>]+href="([^"]*case[^"]*)"[^>]*>([^<]{8,200})<\/a>/gi),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "UK",
      court: "ICLR",
      summary: "",
      url: match[1].startsWith("http") ? match[1] : `https://www.iclr.co.uk${match[1]}`,
      source: "ICLR",
    }));
  } catch (error) {
    console.error(`[legal-search] ICLR failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// Federal Court of Australia — judgments and decisions
async function searchFedCourtAU(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.fedcourt.gov.au/services/access-to-files-and-transcripts/online-files/search?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{8,200})<\/a>/g),
    ];
    return matches
      .filter((m) => /judgment|decision|case|\d{4}/i.test(m[2]))
      .slice(0, 3)
      .map((match) => ({
        title: match[2].trim(),
        citation: "",
        year: match[2].match(/\[(\d{4})\]/)?.[1] || match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
        jurisdiction: "Australia",
        court: "Federal Court of Australia",
        summary: "",
        url: match[1].startsWith("http") ? match[1] : `https://www.fedcourt.gov.au${match[1]}`,
        source: "Federal Court of Australia",
      }));
  } catch (error) {
    console.error(`[legal-search] FedCourtAU failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// Google Scholar — universal legal search fallback
async function searchGoogleScholar(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<h3[^>]*class="gs_rt"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: "International",
      court: "Google Scholar",
      summary: "",
      url: match[1],
      source: "Google Scholar",
    }));
  } catch (error) {
    console.error(`[legal-search] GoogleScholar failed for query: "${query.slice(0, 100)}"`, error);
    return [];
  }
}

// Singapore Cases Online (SCO) — web scraping
async function searchSCO(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.elitigation.sg/gd/s/Results?Filter=SUPCT&YearOfDecision=All&SortBy=Score&SearchPhrase=${encodeURIComponent(query)}&currentPage=1&sortDescending=true&withSummary=true&SearchQueryTime=0&SearchTotalHits=0&ShouldFacetResults=false`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/href="(\/gd\/s\/[^"]+)"[^>]*>([^<]+)<\/a>/g),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "Singapore",
      court: "Supreme Court of Singapore",
      summary: "",
      url: `https://www.elitigation.sg${match[1]}`,
      source: "Singapore Courts",
    }));
  } catch {
    return [];
  }
}

// Singapore Statutes Online (SSO) — sso.agc.gov.sg
async function searchSSO(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://sso.agc.gov.sg/Search/Content?SearchPhrase=${encodeURIComponent(query)}&Category=act`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/href="(\/Act\/[^"]+)"[^>]*>([^<]+)<\/a>/g),
    ];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: "Singapore",
      court: "Parliament of Singapore",
      summary: "",
      url: `https://sso.agc.gov.sg${match[1]}`,
      source: "Singapore Statutes Online",
    }));
  } catch {
    return [];
  }
}

// WorldLII (Global) — web scraping
async function searchWorldLII(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.worldlii.org/cgi-bin/sinosrch.cgi?method=boolean&query=${encodeURIComponent(query)}&results=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [
      ...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+v[^<]+)<\/a>/g),
    ];
    return matches.slice(0, 2).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\[(\d{4})\]/)?.[1] || "",
      jurisdiction: "International",
      court: "",
      summary: "",
      url: match[1].startsWith("http")
        ? match[1]
        : `https://www.worldlii.org${match[1]}`,
      source: "WorldLII",
    }));
  } catch {
    return [];
  }
}

// UK Legislation — legislation.gov.uk API
async function searchUKLegislation(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.legislation.gov.uk/search?text=${encodeURIComponent(query)}&results-count=5`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [...html.matchAll(/<a href="(\/[a-z]+\/\d{4}\/\d+)"[^>]*>([^<]+)<\/a>/g)];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[1].match(/\/(\d{4})\//)?.[1] || "",
      jurisdiction: "UK",
      court: "UK Parliament",
      summary: "",
      url: `https://www.legislation.gov.uk${match[1]}`,
      source: "UK Legislation",
    }));
  } catch {
    return [];
  }
}

// Australian Legislation — legislation.gov.au
async function searchAULegislation(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.legislation.gov.au/Search/${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [...html.matchAll(/<a href="(\/Details\/[^"]+)"[^>]*>([^<]+)<\/a>/g)];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: "Australia",
      court: "Australian Parliament",
      summary: "",
      url: `https://www.legislation.gov.au${match[1]}`,
      source: "Australian Legislation",
    }));
  } catch {
    return [];
  }
}

// Wikipedia summary for legal doctrine/concept grounding
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

// India Code — indiacode.nic.in
async function searchIndiaCode(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://www.indiacode.nic.in/handle/123456789/1362/search?query=${encodeURIComponent(query)}&rpp=5`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [...html.matchAll(/<a href="(\/handle\/[^"]+)"[^>]*>([^<]+)<\/a>/g)];
    return matches.slice(0, 3).map((match) => ({
      title: match[2].trim(),
      citation: "",
      year: match[2].match(/\b((?:19|20)\d{2})\b/)?.[1] || "",
      jurisdiction: "India",
      court: "Indian Parliament",
      summary: "",
      url: `https://www.indiacode.nic.in${match[1]}`,
      source: "India Code",
    }));
  } catch {
    return [];
  }
}

const JURISDICTION_DB_PRIORITY: Record<string, string[]> = {
  us: ["courtlistener", "caselaw", "worldlii", "google_scholar"],
  uk: ["bailii", "uklegislation", "iclr", "commonlii", "courtlistener"],
  au: ["austlii", "aulegislation", "fedcourt", "commonlii", "courtlistener"],
  sg: ["sco", "sso", "singaporelawwatch", "commonlii"],
  eu: ["eurlex", "courtlistener", "worldlii"],
  in: ["indiankanoon", "indiacode", "courtlistener", "worldlii"],
  ca: ["commonlii", "courtlistener", "caselaw"],
  int: ["worldlii", "commonlii", "courtlistener"],
};

function isLegalQuery(query: string): boolean {
  const legalKeywords = [
    // Core legal concepts
    "law", "legal", "court", "case", "contract", "clause", "liability",
    "statute", "act ", " act", "regulation", "judgment", "precedent",
    // Tort/civil
    "tort", "breach", "damages", "negligence", "defendant", "plaintiff",
    "appeal", "jurisdiction", "injunction", "affidavit", "settlement",
    // Criminal
    "criminal", "offence", "offense", "prosecution", "conviction",
    // Corporate/commercial
    "shareholder", "director", "fiduciary", "incorporation", "winding up",
    "liquidation", "insolvency", "oppression", "dividend",
    // IP
    "patent", "trademark", "copyright", "intellectual property",
    // Property/real estate
    "lease", "tenancy", "landlord", "tenant", "mortgage", "conveyance",
    // Employment
    "employment", "wrongful dismissal", "redundancy", "discrimination",
    // Dispute resolution
    "arbitration", "mediation", "litigation", "sue", "sued", "claim",
    // Legal professionals
    "solicitor", "barrister", "lawyer", "attorney", "counsel",
    // Explicit legal question indicators
    "legal options", "legal advice", "my rights", "am i liable",
    "can i sue", "enforceable", "void", "voidable", "null and void",
    "legal recourse", "cause of action",
  ];
  const lower = query.toLowerCase();
  return legalKeywords.some((kw) => {
    if (kw.includes(" ")) return lower.includes(kw);
    return lower.split(/\W+/).includes(kw.trim());
  });
}

// Auto-detect jurisdiction from query keywords
const JURISDICTION_KEYWORDS: { pattern: RegExp; code: string }[] = [
  { pattern: /\b(?:corporations act|australia|australian|austlii|nsw|queensland|victoria|hca|fca)\b/i, code: "au" },
  { pattern: /\b(?:companies act.*singapore|singapore|singaporean|sgd|sghc|sgca|irda|mas|sgx)\b/i, code: "sg" },
  { pattern: /\b(?:uk\b|united kingdom|england|wales|ewca|ewhc|uksc|bailli|english law)\b/i, code: "uk" },
  { pattern: /\b(?:eu\b|european union|european|directive|regulation.*eu|eur-lex|ecj|cjeu)\b/i, code: "eu" },
  { pattern: /\b(?:india|indian|ipc|crpc|indian kanoon|supreme court of india|sc india|bombay|delhi high)\b/i, code: "in" },
  { pattern: /\b(?:us\b|united states|american|federal|circuit|scotus|ussc|usc §|delaware|new york)\b/i, code: "us" },
  { pattern: /\b(?:canada|canadian|scc|onca|bcca|ontario|alberta)\b/i, code: "ca" },
];

function detectJurisdiction(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const { pattern, code } of JURISDICTION_KEYWORDS) {
    if (pattern.test(lower)) return code;
  }
  return undefined;
}

// In-memory cache for legal search results — 5-minute TTL
// Keyed by sanitized query + jurisdiction to avoid leaking unrelated results.
// Eviction runs ONLY on the write path so readers cannot mutate the map
// concurrently (race condition fix).
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
    // Lazy delete on read is fine for a single entry — the size sweep lives on
    // the write path, so we don't mutate the Map while iterating.
    searchCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResult(query: string, jurisdiction: string | undefined, result: LegalSearchResult): void {
  const key = getCacheKey(query, jurisdiction);
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  // Eviction runs on the WRITE path only. We rebuild a snapshot to avoid
  // mutating the Map during iteration.
  if (searchCache.size > CACHE_MAX_ENTRIES) {
    const now = Date.now();
    const survivors: Array<[string, { result: LegalSearchResult; expiresAt: number }]> = [];
    for (const [k, v] of searchCache) {
      if (now <= v.expiresAt) survivors.push([k, v]);
    }
    // Keep the freshest survivors; if we still have too many, drop the oldest.
    survivors.sort((a, b) => b[1].expiresAt - a[1].expiresAt);
    const kept = survivors.slice(0, CACHE_MAX_ENTRIES);
    searchCache.clear();
    for (const [k, v] of kept) searchCache.set(k, v);
  }
}

// Main search function — queries all databases in parallel
export async function searchLegalDatabases(
  query: string,
  jurisdiction?: string
): Promise<LegalSearchResult> {
  // Sanitize input to prevent injection attacks
  const sanitizedQuery = sanitizeSearchQuery(query, 200);
  if (!sanitizedQuery) {
    return { cases: [], databases_searched: [], offline: false };
  }

  if (!isLegalQuery(sanitizedQuery)) {
    return { cases: [], databases_searched: [], offline: false };
  }

  // Check cache first
  const cached = getCachedResult(sanitizedQuery, jurisdiction);
  if (cached) return cached;

  const online = await isOnline();
  if (!online) {
    return { cases: [], databases_searched: [], offline: true };
  }

  // Use sanitized query for all downstream calls
  const safeQuery = sanitizedQuery;

  const dbMap: Record<string, (q: string) => Promise<LegalCase[]>> = {
    courtlistener: searchCourtListener,
    caselaw: searchCaseLaw,
    eurlex: searchEurLex,
    indiankanoon: searchIndianKanoon,
    bailii: searchBAILII,
    austlii: searchAustLII,
    commonlii: searchCommonLII,
    sco: searchSCO,
    sso: searchSSO,
    singaporelawwatch: searchSingaporeLawWatch,
    iclr: searchICLR,
    fedcourt: searchFedCourtAU,
    worldlii: searchWorldLII,
    uklegislation: searchUKLegislation,
    aulegislation: searchAULegislation,
    indiacode: searchIndiaCode,
    google_scholar: searchGoogleScholar,
  };
  const dbNames: Record<string, string> = {
    courtlistener: "CourtListener",
    caselaw: "Caselaw Access Project",
    eurlex: "EUR-Lex",
    indiankanoon: "Indian Kanoon",
    bailii: "BAILII",
    austlii: "AustLII",
    commonlii: "CommonLII",
    sco: "Singapore Courts",
    sso: "Singapore Statutes Online",
    singaporelawwatch: "Singapore Law Watch",
    iclr: "ICLR",
    fedcourt: "Federal Court of Australia",
    worldlii: "WorldLII",
    uklegislation: "UK Legislation",
    aulegislation: "Australian Legislation",
    indiacode: "India Code",
    google_scholar: "Google Scholar",
  };

  // Auto-detect jurisdiction from query keywords (cheap, runs in parallel with LLM call)
  const detectedJurisdiction = detectJurisdiction(safeQuery) || jurisdiction;
  const priority = JURISDICTION_DB_PRIORITY[detectedJurisdiction || "all"] || [];

  // Per-jurisdiction: only search priority databases (max 5), not all 10+
  const dbKeysToSearch = priority.length > 0
    ? priority.slice(0, 5)
    : ["courtlistener", "worldlii", "bailii"];

  // Run extractLegalQuery in parallel with the rest of the setup
  const [extractedQueryRaw, wikiSummary] = await Promise.all([
    extractLegalQuery(safeQuery).catch((err) => {
      console.error("[legal-search] extractLegalQuery failed, using raw query", err);
      return safeQuery;
    }),
    fetchWikipediaSummary(safeQuery),
  ]);
  const extractedQuery = sanitizeSearchQuery(extractedQueryRaw, 200);

  const results = await Promise.allSettled(
    dbKeysToSearch.map((key) => dbMap[key]?.(extractedQuery) ?? Promise.resolve([]))
  );

  const allCases: LegalCase[] = [];
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    allCases.push(...result.value);
  });

  // Score and rank results by relevance, with URL-based deduplication
  const seenUrls = new Set<string>();
  const scoredCases: (LegalCase & { _score: number })[] = [];
  for (const c of allCases) {
    // Defensive: null-guards on API response fields that may be absent
    if (!c) continue;
    const title = c.title || "";
    const jurisdiction = c.jurisdiction || "";

    // Skip duplicates by URL
    if (c.url && seenUrls.has(c.url)) continue;
    if (c.url) seenUrls.add(c.url);

    let score = 0;
    const lowerQuery = safeQuery.toLowerCase();
    const lowerTitle = title.toLowerCase();
    if (lowerQuery.split(/\s+/).some((w) => w.length > 3 && lowerTitle.includes(w))) score += 3;
    if (detectedJurisdiction && jurisdiction.toLowerCase().includes(detectedJurisdiction)) score += 2;
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

  // Cache the result if we got valid cases
  if (topCases.length > 0) {
    setCachedResult(sanitizedQuery, jurisdiction, result);
  }

  return result;
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
