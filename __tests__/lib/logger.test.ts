import { logError, logWarn } from "@/lib/logger";

describe("logger", () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe("logError", () => {
    it("emits a [scope] tag and the message", () => {
      logError("auth", "Login failed");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toBe("[auth] Login failed");
    });

    it("serialises a plain context object to JSON", () => {
      logError("chat", "Request failed", { userId: "abc", attempt: 2 });
      const out = errorSpy.mock.calls[0][0];
      expect(out).toContain("[chat] Request failed");
      expect(out).toContain("userId");
      expect(out).toContain("abc");
    });

    it("flattens Error instances to name/message/stack", () => {
      const err = new Error("boom");
      logError("chat", "boom", err);
      const out = errorSpy.mock.calls[0][0];
      expect(out).toContain("name");
      expect(out).toContain("Error");
      expect(out).toContain("boom");
    });

    it("does not throw when context contains a circular reference", () => {
      const ctx: Record<string, unknown> = {};
      ctx.self = ctx;
      expect(() => logError("chat", "cycle", ctx)).not.toThrow();
    });

    it("omits trailing context when no context is provided", () => {
      logError("chat", "no ctx");
      expect(errorSpy.mock.calls[0][0]).toBe("[chat] no ctx");
    });
  });

  describe("logWarn", () => {
    it("emits to console.warn with the scope tag", () => {
      logWarn("deps", "missing optional");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toBe("[deps] missing optional");
    });
  });
});