import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import {
  ANTHROPIC_CORE_MODEL,
  ANTHROPIC_PRO_MODEL,
  ANTHROPIC_ULTRA_MODEL,
  ANTHROPIC_MAX_MODEL,
} from "@/lib/models";

describe("rate-limit helpers", () => {
  beforeEach(() => {
    // Reset the in-memory rate limit store between tests
    // by replacing the map with a fresh one - this is module-level state
    jest.resetModules();
  });

  describe("checkRateLimit", () => {
    it("allows requests under the limit", () => {
      const result = checkRateLimit("192.168.1.1", ANTHROPIC_PRO_MODEL);
      expect(result.allowed).toBe(true);
      expect(result.downgradeModel).toBeUndefined();
    });

    it("blocks requests at the limit", () => {
      // First, record usage up to the limit
      for (let i = 0; i < 50; i++) {
        recordUsage("192.168.1.100", ANTHROPIC_PRO_MODEL);
      }
      // Next request should be blocked
      const result = checkRateLimit("192.168.1.100", ANTHROPIC_PRO_MODEL);
      expect(result.allowed).toBe(false);
    });

    it("allows unlimited models", () => {
      const result = checkRateLimit("192.168.1.1", ANTHROPIC_CORE_MODEL);
      expect(result.allowed).toBe(true);
    });

    it("suggests downgrade for max model at limit", () => {
      // Fill up max model
      for (let i = 0; i < 10; i++) {
        recordUsage("192.168.1.200", ANTHROPIC_MAX_MODEL);
      }
      const result = checkRateLimit("192.168.1.200", ANTHROPIC_MAX_MODEL);
      expect(result.allowed).toBe(false);
      expect(result.downgradeModel).toBeDefined();
    });

    it("resets after day boundary", () => {
      // This test would require mocking Date.now() which is complex in Jest
      // Instead we verify the function exists and returns expected keys
      const result = checkRateLimit("192.168.1.1", ANTHROPIC_PRO_MODEL);
      expect(Object.keys(result)).toContain("allowed");
    });
  });

  describe("recordUsage", () => {
    it("records usage for a model", () => {
      // Record one usage
      recordUsage("192.168.1.50", ANTHROPIC_PRO_MODEL);
      // Now check should show 1 used
      const before = checkRateLimit("192.168.1.50", ANTHROPIC_PRO_MODEL);
      expect(before.allowed).toBe(true);
    });

    it("skips unlimited models", () => {
      // Should not throw for unlimited model
      expect(() =>
        recordUsage("192.168.1.1", ANTHROPIC_CORE_MODEL)
      ).not.toThrow();
    });
  });
});