import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { validateUploadedFile } from "../fileValidation";

describe("validateUploadedFile", () => {
  it("requires a PDF magic header", async () => {
    await expect(
      validateUploadedFile(Buffer.from("not a pdf"), "pdf", "application/pdf"),
    ).rejects.toThrow(/valid PDF/);
    await expect(
      validateUploadedFile(Buffer.from("%PDF-1.7"), "pdf", "application/pdf"),
    ).resolves.toBeUndefined();
  });

  it("requires Office ZIP markers to match the extension", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document />");
    const docx = await zip.generateAsync({ type: "nodebuffer" });
    await expect(
      validateUploadedFile(docx, "docx", "application/octet-stream"),
    ).resolves.toBeUndefined();
    await expect(
      validateUploadedFile(docx, "xlsx", "application/octet-stream"),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects a clearly conflicting MIME type and accepts legacy OLE", async () => {
    await expect(
      validateUploadedFile(Buffer.alloc(16), "doc", "application/pdf"),
    ).rejects.toThrow(/MIME/);
    await expect(
      validateUploadedFile(
        Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.alloc(64)]),
        "doc",
        "application/msword",
      ),
    ).resolves.toBeUndefined();
  });
});
