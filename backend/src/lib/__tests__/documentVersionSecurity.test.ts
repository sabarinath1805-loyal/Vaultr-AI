import { describe, expect, it } from "vitest";
import {
  assertDocumentVersionTrusted,
  classifyDocumentVersionState,
  isDocumentVersionTrusted,
  scanVersionContent,
  UntrustedDocumentVersionError,
} from "../documentVersionSecurity";

describe("document version trust boundary", () => {
  it.each([
    ["uploaded", "pending"],
    ["pending_scan", "pending"],
    ["processing", "processing"],
    ["quarantined", "quarantined"],
    ["failed", "failed"],
    ["ready", "trusted"],
    ["clean", "trusted"],
    ["unknown", "unknown"],
    [undefined, "unknown"],
  ])("classifies %s as %s", (state, expected) => {
    expect(classifyDocumentVersionState(state)).toBe(expected);
    expect(isDocumentVersionTrusted(state)).toBe(expected === "trusted");
  });

  it("asserts trusted states and rejects unknown states", () => {
    expect(() => assertDocumentVersionTrusted("ready")).not.toThrow();
    expect(() => assertDocumentVersionTrusted("clean")).not.toThrow();
    expect(() => assertDocumentVersionTrusted("pending_scan")).toThrow(
      UntrustedDocumentVersionError,
    );
    expect(() => assertDocumentVersionTrusted("future_state")).toThrow(
      UntrustedDocumentVersionError,
    );
  });

  it("maps the development scanner bypass to a trusted post-scan result", async () => {
    await expect(
      scanVersionContent(Buffer.from("safe"), "safe.pdf", {
        NODE_ENV: "test",
      }),
    ).resolves.toMatchObject({
      processingState: "clean",
      trusted: true,
      scan: { status: "bypassed" },
    });
  });

  it("fails closed when the required scanner is unavailable", async () => {
    await expect(
      scanVersionContent(Buffer.from("safe"), "safe.pdf", {
        NODE_ENV: "production",
        DOCUMENT_SCANNER_REQUIRED: "true",
      }),
    ).resolves.toMatchObject({
      processingState: "failed",
      trusted: false,
      scan: { status: "unavailable" },
    });
  });
});
