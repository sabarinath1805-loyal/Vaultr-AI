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
      `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&format=json&page_size=3`,
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

// Harvard Caselaw Access Project (USA) — free API
async function searchCaseLaw(query: string): Promise<LegalCase[]> {
  try {
    const response = await fetch(
      `https://api.case.law/v1/cases/?search=${encodeURIComponent(query)}&page_size=3`,
      { signal: AbortSignal.timeout(8000) }
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

// Detect if query is legal in nature (avoid querying DBs for casual chat)
function isLegalQuery(query: string): boolean {
  const legalKeywords = [
    "law",
    "legal",
    "court",
    "case",
    "contract",
    "clause",
    "liability",
    "statute",
    "act",
    "regulation",
    "judgment",
    "precedent",
    "tort",
    "breach",
    "damages",
    "negligence",
    "defendant",
    "plaintiff",
    "appeal",
    "jurisdiction",
    "counsel",
    "privilege",
    "evidence",
    "criminal",
    "civil",
    "employment",
    "IP",
    "patent",
    "trademark",
    "copyright",
    "property",
    "lease",
    "tenancy",
    "arbitration",
    "injunction",
    "affidavit",
    "discovery",
    "deposition",
    "settlement",
    "sued",
    "sue",
    "legal advice",
    "solicitor",
    "barrister",
    "lawyer",
    "attorney",
    "judge",
  ];
  const lower = query.toLowerCase();
  return legalKeywords.some((kw) => lower.includes(kw));
}

// Main search function — queries all databases in parallel
export async function searchLegalDatabases(
  query: string
): Promise<LegalSearchResult> {
  if (!isLegalQuery(query)) {
    return { cases: [], databases_searched: [], offline: false };
  }

  const online = await isOnline();
  if (!online) {
    return { cases: [], databases_searched: [], offline: true };
  }

  const [
    courtListenerResults,
    caseLawResults,
    eurLexResults,
    indianKanoonResults,
    bailiiResults,
    austliiResults,
    commonliiResults,
    scoResults,
    worldliiResults,
  ] = await Promise.allSettled([
    searchCourtListener(query),
    searchCaseLaw(query),
    searchEurLex(query),
    searchIndianKanoon(query),
    searchBAILII(query),
    searchAustLII(query),
    searchCommonLII(query),
    searchSCO(query),
    searchWorldLII(query),
  ]);

  const allCases: LegalCase[] = [
    ...(courtListenerResults.status === "fulfilled"
      ? courtListenerResults.value
      : []),
    ...(caseLawResults.status === "fulfilled" ? caseLawResults.value : []),
    ...(eurLexResults.status === "fulfilled" ? eurLexResults.value : []),
    ...(indianKanoonResults.status === "fulfilled"
      ? indianKanoonResults.value
      : []),
    ...(bailiiResults.status === "fulfilled" ? bailiiResults.value : []),
    ...(austliiResults.status === "fulfilled" ? austliiResults.value : []),
    ...(commonliiResults.status === "fulfilled"
      ? commonliiResults.value
      : []),
    ...(scoResults.status === "fulfilled" ? scoResults.value : []),
    ...(worldliiResults.status === "fulfilled" ? worldliiResults.value : []),
  ];

  const databasesSearched = [
    "CourtListener",
    "Caselaw Access Project",
    "EUR-Lex",
    "Indian Kanoon",
    "BAILII",
    "AustLII",
    "CommonLII",
    "Singapore Courts",
    "WorldLII",
  ];

  return {
    cases: allCases.slice(0, 12),
    databases_searched: databasesSearched,
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
  return `\n\nRELEVANT CASE LAW FROM LEGAL DATABASES:\n${formatted}\n\nCite these cases in your response where relevant. Use the exact case names provided above.`;
}
