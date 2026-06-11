import {
  retrieveRelevantChunks,
  retrieveMatterMemory,
  retrieveUserMemory,
  formatRetrievedContext,
  type RetrievedChunk,
  type RetrievedMemory,
} from "@/lib/rag-retrieve";

describe("rag-retrieve", () => {
  // Use separate mocks for embedText (Voyage) and Supabase RPC calls
  beforeEach(() => {
    // Supabase needs these set for getSupabaseAdmin to work
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.VOYAGE_API_KEY = "test-voyage-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VOYAGE_API_KEY;
  });

  describe("retrieveRelevantChunks", () => {
    it("returns empty array when Supabase not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const result = await retrieveRelevantChunks({ query: "test", userId: "user-1" });
      expect(result).toEqual([]);
    });

    it("filters results below 0.65 similarity threshold", async () => {
      const mockResponse = (body: unknown): Response => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
        text: async () => JSON.stringify(body),
        headers: new Headers(),
        redirected: false,
        type: "basic",
        url: "",
        clone: () => mockResponse(body),
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
      } as unknown as Response);

      jest.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("voyageai.com")) {
          return mockResponse({ data: [{ embedding: [0.1, 0.2] }] });
        }
        return mockResponse([
          { id: "1", document_name: "Doc A", chunk_text: "high score", similarity: 0.85, source: "vault", matter_id: null },
          { id: "2", document_name: "Doc B", chunk_text: "low score", similarity: 0.5, source: "vault", matter_id: null },
        ]);
      });

      const result = await retrieveRelevantChunks({ query: "test", userId: "user-1" });
      expect(result).toHaveLength(1);
      expect(result[0].documentName).toBe("Doc A");
    });
  });

  describe("retrieveMatterMemory", () => {
    it("returns empty array on error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
      const result = await retrieveMatterMemory({ query: "test", matterId: "matter-1" });
      expect(result).toEqual([]);
    });
  });

  describe("retrieveUserMemory", () => {
    it("returns empty array on error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
      const result = await retrieveUserMemory({ query: "test", userId: "user-1" });
      expect(result).toEqual([]);
    });
  });

  describe("formatRetrievedContext", () => {
    it("returns empty string when all arrays empty", () => {
      const result = formatRetrievedContext([], [], []);
      expect(result).toBe("");
    });

    it("formats chunks with document name prefix", () => {
      const chunks: RetrievedChunk[] = [
        {
          id: "1",
          documentName: "Contract.pdf",
          chunkText: "Termination clause details",
          similarity: 0.9,
          source: "vault",
          matterId: null,
        },
      ];
      const result = formatRetrievedContext(chunks, [], []);
      expect(result).toContain("[Contract.pdf]");
      expect(result).toContain("Termination clause details");
      expect(result).toContain("Relevant Documents");
    });

    it("formats matter memories as bullet list", () => {
      const memories: RetrievedMemory[] = [
        { id: "1", content: "Client is in Singapore", memoryType: "fact", similarity: 0.8 },
        { id: "2", content: "Matter filed in 2024", memoryType: "fact", similarity: 0.75 },
      ];
      const result = formatRetrievedContext([], memories, []);
      expect(result).toContain("Matter Context");
      expect(result).toContain("- Client is in Singapore");
      expect(result).toContain("- Matter filed in 2024");
    });

    it("formats user memories as bullet list", () => {
      const memories: RetrievedMemory[] = [
        { id: "1", content: "User prefers UK spelling", memoryType: "preference", similarity: 0.7 },
      ];
      const result = formatRetrievedContext([], [], memories);
      expect(result).toContain("User Context");
      expect(result).toContain("- User prefers UK spelling");
    });
  });
});