import { formatCasesForContext, type LegalCase } from "@/lib/legal-search";

describe("legal-search helpers", () => {
  describe("module smoke test", () => {
    it("loads the module and exposes formatCasesForContext", () => {
      expect(typeof formatCasesForContext).toBe("function");
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

    it("respects maxCases parameter", () => {
      const cases: LegalCase[] = [
        {
          title: "Case 1",
          citation: "",
          year: "",
          jurisdiction: "US",
          court: "",
          summary: "",
          url: "",
          source: "CourtListener",
        },
        {
          title: "Case 2",
          citation: "",
          year: "",
          jurisdiction: "US",
          court: "",
          summary: "",
          url: "",
          source: "CourtListener",
        },
      ];
      const result = formatCasesForContext(cases, 1);
      expect(result).toContain("Case 1");
      expect(result).not.toContain("Case 2");
    });
  });
});
