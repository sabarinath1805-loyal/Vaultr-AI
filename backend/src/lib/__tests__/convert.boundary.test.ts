import { describe, expect, it } from "vitest";
import { validateConvertedPdf } from "../convert";

describe("document conversion output boundary", () => {
  it("rejects converter crashes represented by missing output", () => {
    expect(() => validateConvertedPdf(Buffer.alloc(0))).toThrow(/invalid PDF/);
  });

  it("rejects non-PDF converter output", () => {
    expect(() => validateConvertedPdf(Buffer.from("not-pdf"))).toThrow(/invalid PDF/);
  });

  it("accepts a PDF header before storage", () => {
    expect(validateConvertedPdf(Buffer.from("%PDF-1.7\nbody"))).toBeInstanceOf(Buffer);
  });
});
