import { afterEach, describe, expect, it, vi } from "vitest";
import { createRawLlmStreamRecorder, logRawLlmStream } from "../rawStreamLog";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("raw LLM stream logging", () => {
  it("is disabled in production even when explicitly requested", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_RAW_LLM_STREAM", "true");
    expect(createRawLlmStreamRecorder({ provider: "test", model: "test" })).toBeNull();
    const dir = vi.spyOn(console, "dir").mockImplementation(() => undefined);
    logRawLlmStream({ provider: "test", model: "test", iteration: 1, label: "x", payload: { content: "secret" } });
    expect(dir).not.toHaveBeenCalled();
  });

  it("redacts credentials and content in local opt-in console capture", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_RAW_LLM_STREAM", "true");
    const dir = vi.spyOn(console, "dir").mockImplementation(() => undefined);
    logRawLlmStream({
      provider: "test",
      model: "test",
      iteration: 1,
      label: "x",
      payload: { api_key: "secret", content: "private document text" },
    });
    expect(dir).toHaveBeenCalledWith(
      expect.objectContaining({
        api_key: "[REDACTED]",
        content: expect.stringMatching(/CONTENT REDACTED/),
      }),
      expect.any(Object),
    );
  });
});
