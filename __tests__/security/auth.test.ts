import {
  sanitizeString,
  isValidUUID,
  AuthError,
} from "@/lib/api-auth";

describe("api-auth helpers", () => {
  describe("sanitizeString", () => {
    it("returns empty string for non-string input", () => {
      // @ts-expect-error - testing runtime guard
      expect(sanitizeString(null)).toBe("");
      // @ts-expect-error - testing runtime guard
      expect(sanitizeString(undefined)).toBe("");
      // @ts-expect-error - testing runtime guard
      expect(sanitizeString(123)).toBe("");
    });

    it("removes control characters but preserves newlines and tabs", () => {
      const input = "hello\x00\x01world\n\tnewline";
      const result = sanitizeString(input);
      expect(result).toBe("helloworld\n\tnewline");
    });

    it("truncates to maxLength", () => {
      const input = "a".repeat(500);
      const result = sanitizeString(input, 100);
      expect(result.length).toBe(100);
    });

    it("trims whitespace from ends", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });
  });

  describe("isValidUUID", () => {
    it("accepts a valid v4 UUID", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("accepts uppercase variants", () => {
      expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    });

    it("rejects malformed UUIDs", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
      expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
    });

    it("rejects non-string input", () => {
      // @ts-expect-error - testing runtime guard
      expect(isValidUUID(null)).toBe(false);
      // @ts-expect-error - testing runtime guard
      expect(isValidUUID(123)).toBe(false);
    });
  });

  describe("AuthError", () => {
    it("carries status and userMessage", () => {
      const err = new AuthError(401, "nope");
      expect(err.status).toBe(401);
      expect(err.userMessage).toBe("nope");
      expect(err.message).toBe("nope");
      expect(err.name).toBe("AuthError");
    });
  });
});
