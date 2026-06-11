import {
  extractAndSaveMemories,
} from "@/lib/rag-memory";

function mockResponse(body: unknown): Response {
  return {
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
  } as unknown as Response;
}

describe("rag-memory", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.VOYAGE_API_KEY = "test-voyage-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VOYAGE_API_KEY;
    jest.restoreAllMocks();
  });

  describe("extractAndSaveMemories", () => {
    it("handles invalid JSON response gracefully", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce(
        mockResponse({
          choices: [{ message: { content: "not valid json {{{" } }],
        })
      );

      // Should not throw
      await expect(
        extractAndSaveMemories({
          userId: "user-1",
          userMessage: "test",
          lexResponse: "test",
          claudeOpusApiKey: "test-key",
          baseUrl: "https://api.test.com",
        })
      ).resolves.toBeUndefined();
    });

    it("extracts and saves valid memories", async () => {
      const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("claudeopus.pro") || url.includes("api.test.com")) {
          return mockResponse({
            choices: [{
              message: {
                content: JSON.stringify({
                  user_memories: ["User prefers Singapore law context for matters"],
                  matter_memories: ["Matter involves contract dispute in 2024"],
                }),
              },
            }],
          });
        }
        // Voyage embedding + Supabase insert
        return mockResponse({ data: [{ embedding: [0.1] }] });
      });

      await extractAndSaveMemories({
        userId: "user-1",
        matterId: "matter-1",
        userMessage: "test",
        lexResponse: "test",
        claudeOpusApiKey: "test-key",
        baseUrl: "https://api.test.com",
      });

      // At least 2 fetches: Claude API + Voyage
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});