import {
  embedText,
  embedDocument,
  embedBatch,
  chunkText,
} from "@/lib/embeddings";

describe("embeddings", () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("module smoke test", () => {
    it("loads the module and exposes functions", () => {
      expect(typeof embedText).toBe("function");
      expect(typeof embedDocument).toBe("function");
      expect(typeof embedBatch).toBe("function");
      expect(typeof chunkText).toBe("function");
    });
  });

  describe("chunkText", () => {
    it("splits text into correct chunk sizes with overlap", () => {
      // 600 words with chunkSize=512, overlap=64 → 2 chunks
      const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
      const chunks = chunkText(words, 512, 64);
      expect(chunks.length).toBe(2);
    });

    it("skips chunks under 50 chars", () => {
      const result = chunkText("short text", 512, 64);
      expect(result).toHaveLength(0);
    });

    it("handles empty input", () => {
      expect(chunkText("")).toHaveLength(0);
      expect(chunkText("   ")).toHaveLength(0);
    });

    it("respects custom chunkSize and overlap", () => {
      const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
      const chunks = chunkText(text, 100, 20);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("embedText", () => {
    it("throws when VOYAGE_API_KEY missing", async () => {
      delete process.env.VOYAGE_API_KEY;
      await expect(embedText("test query")).rejects.toThrow("VOYAGE_API_KEY is not configured");
    });

    it("returns array of numbers when API succeeds", async () => {
      process.env.VOYAGE_API_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      });

      const result = await embedText("test query");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result.every((n) => typeof n === "number")).toBe(true);
    });
  });

  describe("embedBatch", () => {
    it("batches correctly when more than 128 inputs", async () => {
      process.env.VOYAGE_API_KEY = "test-key";
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array.from({ length: 128 }, (_, i) => ({ embedding: [i * 0.01] })),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array.from({ length: 50 }, (_, i) => ({ embedding: [(i + 128) * 0.01] })),
          }),
        });

      const inputs = Array.from({ length: 178 }, (_, i) => `text${i}`);
      const result = await embedBatch(inputs, "document");
      expect(result).toHaveLength(178);
    });

    it("handles empty array", async () => {
      process.env.VOYAGE_API_KEY = "test-key";
      const result = await embedBatch([]);
      expect(result).toHaveLength(0);
    });
  });
});