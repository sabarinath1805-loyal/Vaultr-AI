import { getChatErrorMessage } from "@/components/chat/chat-flow-types";

describe("getChatErrorMessage", () => {
  // navigator is jsdom/node-only — guard so the suites are robust on either.
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
    } else {
      // @ts-expect-error — restoring initial "no navigator" state
      delete globalThis.navigator;
    }
  });

  function setOnline(online: boolean | undefined): void {
    if (online === undefined) {
      // @ts-expect-error — test helper
      delete globalThis.navigator;
      return;
    }
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: online },
    });
  }

  it("reports offline first when navigator says so", () => {
    setOnline(false);
    const msg = getChatErrorMessage(new Error("503 Service Unavailable"), true);
    expect(msg).toMatch(/no internet/i);
  });

  it("maps 503 to a high-demand message in cloud mode", () => {
    setOnline(true);
    const msg = getChatErrorMessage(new Error("upstream 503"), true);
    expect(msg).toMatch(/high demand/i);
  });

  it("maps 401/403 to an auth error", () => {
    setOnline(true);
    expect(getChatErrorMessage(new Error("401 unauthorized"), true)).toMatch(/authentication/i);
    expect(getChatErrorMessage(new Error("403 forbidden"), true)).toMatch(/authentication/i);
  });

  it("maps 429 to a rate-limit message", () => {
    setOnline(true);
    expect(getChatErrorMessage(new Error("rate 429"), true)).toMatch(/rate limit/i);
  });

  it("maps timeout-shaped messages", () => {
    setOnline(true);
    expect(getChatErrorMessage(new Error("Request Timeout"), true)).toMatch(/timed out/i);
  });

  it("mentions Ollama when not in cloud mode", () => {
    setOnline(true);
    const msg = getChatErrorMessage(new Error("some unrelated failure"), false);
    expect(msg).toMatch(/ollama/i);
  });

  it("falls back to a generic message in cloud mode for an unknown error", () => {
    setOnline(true);
    const msg = getChatErrorMessage(new Error("nonsense"), true);
    expect(msg).toMatch(/something went wrong|switching models/i);
  });

  it("tolerates an empty error message", () => {
    setOnline(true);
    const msg = getChatErrorMessage(new Error(""), true);
    expect(msg).toMatch(/something went wrong|switching models/i);
  });
});