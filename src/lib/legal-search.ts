// Legal database search service
// Queries multiple legal databases in parallel and returns relevant cases

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
}

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
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
  } catch {
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
    return (data.results || []).slice(0, 3).map((item: Record<string, unknown>) => ({
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
  } catch {
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
  } catch {
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

const JURISDICTION_DB_PRIORITY: Record<string, string[]> = {
  us: ["courtlistener", "caselaw", "worldlii"],
  uk: ["bailii", "commonlii", "courtlistener"],
  au: ["austlii", "commonlii", "courtlistener"],
  sg: ["sco", "sso", "commonlii"],
  eu: ["eurlex", "courtlistener", "worldlii"],
  in: ["indiankanoon", "courtlistener", "worldlii"],
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
  { pattern: /\b(?:companies act.*singapore|singapore|singaporean|sgd|sghc|sgca|mas)\b/i, code: "sg" },
  { pattern: /\b(?:uk\b|united kingdom|england|wales|ewca|ewhc|uksc|bailli|english law)\b/i, code: "uk" },
  { pattern: /\b(?:eu\b|european union|european|directive|regulation.*eu|eur-lex|ecj|cjeu)\b/i, code: "eu" },
  { pattern: /\b(?:india|indian|ipc|crpc|indian kanoon|supreme court of india|bombay|delhi high)\b/i, code: "in" },
  { pattern: /\b(?:us\b|united states|american|federal|circuit|scotus|ussc|usc §)\b/i, code: "us" },
  { pattern: /\b(?:canada|canadian|scc|onca|bcca|ontario|alberta)\b/i, code: "ca" },
];

function detectJurisdiction(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const { pattern, code } of JURISDICTION_KEYWORDS) {
    if (pattern.test(lower)) return code;
  }
  return undefined;
}

// Main search function — queries all databases in parallel
export async function searchLegalDatabases(
  query: string,
  jurisdiction?: string
): Promise<LegalSearchResult> {
  if (!isLegalQuery(query)) {
    return { cases: [], databases_searched: [], offline: false };
  }

  const online = await isOnline();
  if (!online) {
    return { cases: [], databases_searched: [], offline: true };
  }

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
    worldlii: searchWorldLII,
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
    worldlii: "WorldLII",
  };

  const extractedQuery = await extractLegalQuery(query);

  // Auto-detect jurisdiction from query keywords, falling back to explicit or "us"
  const detectedJurisdiction = detectJurisdiction(query) || jurisdiction;
  const priority = JURISDICTION_DB_PRIORITY[detectedJurisdiction || "us"] || JURISDICTION_DB_PRIORITY["us"];
  const allDbKeys = Object.keys(dbMap);
  const orderedKeys = [
    ...priority,
    ...allDbKeys.filter((k) => !priority.includes(k)),
  ];

  const results = await Promise.allSettled(
    orderedKeys.map((key) => dbMap[key](extractedQuery))
  );

  const priorityCases: LegalCase[] = [];
  const otherCases: LegalCase[] = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    if (index < priority.length) {
      priorityCases.push(...result.value);
    } else {
      otherCases.push(...result.value);
    }
  });

  const allCases = [...priorityCases, ...otherCases];

  return {
    cases: allCases.slice(0, 12),
    databases_searched: orderedKeys.map((k) => dbNames[k]),
    offline: false,
  };
}

// Format cases for injection into Lex's context window
export function formatCasesForContext(cases: LegalCase[]): string {
  if (cases.length === 0) return "";
  const formatted = cases
    .map(
      (c) =>
        `- ${c.title}${c.citation ? ` [${c.citation}]` : ""}${c.year ? ` (${c.year})` : ""} — ${c.jurisdiction}${c.summary ? `: ${c.summary.slice(0, 200)}` : ""}`
    )
    .join("\n");
  return `\n\nRELEVANT CASE LAW FROM LEGAL DATABASES (do not reproduce these search queries or database names in your response — cite cases naturally inline):\n${formatted}\n\nCite these cases in your response where relevant. Use the exact case names provided above.`;
}
