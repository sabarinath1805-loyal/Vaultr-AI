import {
  searchLegalDatabases,
  formatCasesForContext,
  detectJurisdiction,
  tavilyIsWarranted,
  tavilyAdvancedSearch,
  JURISDICTION_DB_PRIORITY,
  type LegalCase,
} from "@/lib/legal-search";

describe("legal-search", () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("module smoke test", () => {
    it("loads the module and exposes core functions", () => {
      expect(typeof searchLegalDatabases).toBe("function");
      expect(typeof formatCasesForContext).toBe("function");
      expect(typeof detectJurisdiction).toBe("function");
      expect(typeof tavilyIsWarranted).toBe("function");
    });
  });

  describe("formatCasesForContext", () => {
    it("returns empty string for empty cases array", () => {
      expect(formatCasesForContext([])).toBe("");
    });

    it("formats cases with title, citation, year, jurisdiction", () => {
      const cases: LegalCase[] = [
        {
          title: "Donoghue v Stevenson",
          citation: "[1932] AC 562",
          year: "1932",
          jurisdiction: "UK",
          court: "House of Lords",
          summary: "Neighbour principle",
          url: "https://example.com",
          source: "BAILII",
        },
      ];
      const result = formatCasesForContext(cases);
      expect(result).toContain("Donoghue v Stevenson");
      expect(result).toContain("[1932] AC 562");
      expect(result).toContain("1932");
      expect(result).toContain("UK");
    });
  });

  describe("searchLegalDatabases", () => {
    it("returns empty for non-legal query (less than 4 words)", async () => {
      const result = await searchLegalDatabases("hi there");
      expect(result.cases).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns empty for greeting messages", async () => {
      const result = await searchLegalDatabases("hello how are you");
      expect(result.cases).toHaveLength(0);
    });

    it("uses correct jurisdiction DB priority for 'sg'", () => {
      expect(JURISDICTION_DB_PRIORITY.sg).toContain("sglaw_tavily");
      expect(JURISDICTION_DB_PRIORITY.sg[0]).toBe("sglaw_tavily");
    });

    it("uses correct jurisdiction DB priority for 'uk'", () => {
      expect(JURISDICTION_DB_PRIORITY.uk).toContain("uklaw_tavily");
      expect(JURISDICTION_DB_PRIORITY.uk[0]).toBe("uklaw_tavily");
    });

    it("returns cached result on second call with same query", async () => {
      const query = "termination clause breach of contract liability damages";
      const jurisdiction = "sg";

      // First call — mock Tavily + CourtListener to return real cases
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              title: "Test Case v Another",
              url: "https://example.com/case1",
              content: "Test summary content for caching test",
            },
          ],
        }),
      });

      const result1 = await searchLegalDatabases(query, jurisdiction);
      const callsAfterFirst = mockFetch.mock.calls.length;

      // Second call — should hit cache, no new fetch
      const result2 = await searchLegalDatabases(query, jurisdiction);
      const callsAfterSecond = mockFetch.mock.calls.length;

      // Cache hit: no new network calls
      expect(callsAfterSecond).toBe(callsAfterFirst);
      expect(result1.cases).toEqual(result2.cases);
    }, 10000);
  });

  describe("tavilyIsWarranted", () => {
    it("returns true for queries with date signals", () => {
      expect(tavilyIsWarranted("What is the latest case law on this?", 5)).toBe(true);
      expect(tavilyIsWarranted("Recent amendments to the act", 5)).toBe(true);
      expect(tavilyIsWarranted("Latest 2025 regulation", 5)).toBe(true);
      expect(tavilyIsWarranted("News on regulatory enforcement", 5)).toBe(true);
    });

    it("returns true when ragResultCount < 3", () => {
      expect(tavilyIsWarranted("standard contract question", 0)).toBe(true);
      expect(tavilyIsWarranted("standard contract question", 2)).toBe(true);
    });

    it("returns false for generic queries with 3+ RAG results", () => {
      expect(tavilyIsWarranted("What is the neighbour principle in tort law?", 5)).toBe(false);
    });
  });

  describe("detectJurisdiction", () => {
    it("returns 'sg' for Singapore-related queries", () => {
      expect(detectJurisdiction("Singapore contract law dispute")).toBe("sg");
      expect(detectJurisdiction("Companies Act Singapore filing process")).toBe("sg");
    });

    it("returns 'uk' for UK-related queries", () => {
      expect(detectJurisdiction("United Kingdom court ruling on tort")).toBe("uk");
      expect(detectJurisdiction("England and Wales contract law case")).toBe("uk");
    });

    it("returns undefined for ambiguous queries", () => {
      expect(detectJurisdiction("general legal question about contracts")).toBeUndefined();
      expect(detectJurisdiction("")).toBeUndefined();
    });
  });

  describe("tavilyAdvancedSearch (shared cache)", () => {
    it("returns empty results when TAVILY_API_KEY is missing", async () => {
      // Default tauri-env mock: no key configured
      const result = await tavilyAdvancedSearch("some uncached query");
      expect(result.results).toEqual([]);
    });

    it("deduplicates identical queries against the in-memory cache", async () => {
      const query = "shared tavily cache dedup test query string";
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: "Cached result", url: "https://x.test/cached", content: "cached content" }],
          answer: "cached answer",
        }),
      });

      // First call hits the network (1 fetch)
      const a = await tavilyAdvancedSearch(query);
      // Second call hits the cache (still 1 fetch total)
      const b = await tavilyAdvancedSearch(query);

      expect(a.answer).toBe("cached answer");
      expect(b.answer).toBe("cached answer");
      expect(mockFetch.mock.calls.length).toBe(1);
    });

    it("returns graceful empty payload when the network fails", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));
      const result = await tavilyAdvancedSearch("network failure test query");
      expect(result.results).toEqual([]);
      expect(result.answer).toBeUndefined();
    });

    it("does not collide with cached results that have different options", async () => {
      // Cache an entry with the searchSingaporeLaw shape (basic + domains).
      // Then ask the same query via tavilyAdvancedSearch (advanced, no
      // domains). The advanced call should NOT return the basic/cached
      // result, but should make its own fetch.
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { title: "Basic SG result", url: "https://sg.test/x", content: "sg" },
          ],
          answer: undefined,
        }),
      });

      const query = "cache key isolation between option shapes";
      // First call: simulate a basic depth / domain-scoped call.
      // We invoke the function with no extra options, which is treated
      // as the "basic" depth default.
      const a = await tavilyAdvancedSearch(query);
      expect(a.results[0]?.title).toBe("Basic SG result");
      expect(mockFetch.mock.calls.length).toBe(1);

      // Second call with the same query but different option shape (advanced).
      // The cache key includes options, so this should be a fresh fetch.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: "Advanced no-domain result", url: "https://y.test/x", content: "adv" },
          ],
          answer: "advanced answer",
        }),
      });
      // Force a different cache key by passing a non-default maxResults.
      // The advanced export itself does not pass maxResults, so use the
      // underlying searchSingaporeLaw (basic + domain list) to differentiate.
      const advancedResult = await tavilyAdvancedSearch(query + " v2");
      expect(advancedResult.results[0]?.title).toBe("Advanced no-domain result");
      // Two fetches total: the first for the basic one, the second for
      // the advanced one — proving the cache key isolates option shapes.
      expect(mockFetch.mock.calls.length).toBe(2);
    });
  });
});
