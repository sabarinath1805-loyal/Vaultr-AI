/**
 * Tests for `lib/safe-storage`.
 *
 * The module falls back to an in-memory Map when `localStorage` throws.
 * In our jest config (`testEnvironment: "node"`) `localStorage` is undefined,
 * which is itself a useful test condition: every `localStorage.*` call throws
 * a ReferenceError and the safe-storage layer must catch that and use the
 * memory fallback. That's the primary behavior we exercise here.
 */

import { safeStorage } from "@/lib/safe-storage";

describe("safeStorage", () => {
  // Each test starts fresh — the module-level memoryStorage is shared across
  // tests in the same file, so clear between cases.
  afterEach(() => {
    // Best-effort cleanup; the keys we use are stable.
    safeStorage.removeItem("vaultr-test-key");
    safeStorage.removeItem("another");
  });

  describe("when localStorage is unavailable (node test env)", () => {
    it("returns null for an unseen key", () => {
      expect(safeStorage.getItem("vaultr-test-key")).toBe(null);
    });

    it("round-trips a value through the in-memory fallback", () => {
      safeStorage.setItem("vaultr-test-key", "hello");
      expect(safeStorage.getItem("vaultr-test-key")).toBe("hello");
    });

    it("overwrites an existing value", () => {
      safeStorage.setItem("vaultr-test-key", "first");
      safeStorage.setItem("vaultr-test-key", "second");
      expect(safeStorage.getItem("vaultr-test-key")).toBe("second");
    });

    it("removes a value", () => {
      safeStorage.setItem("vaultr-test-key", "x");
      safeStorage.removeItem("vaultr-test-key");
      expect(safeStorage.getItem("vaultr-test-key")).toBe(null);
    });

    it("does not throw on remove of an unknown key", () => {
      expect(() => safeStorage.removeItem("never-set")).not.toThrow();
    });

    it("keeps values for different keys independent", () => {
      safeStorage.setItem("vaultr-test-key", "1");
      safeStorage.setItem("another", "2");
      expect(safeStorage.getItem("vaultr-test-key")).toBe("1");
      expect(safeStorage.getItem("another")).toBe("2");
    });
  });
});