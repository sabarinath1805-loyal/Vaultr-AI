import mammoth from "mammoth";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import { extractFileContent } from "@/lib/extract-file-content";

interface DocumentForExtraction {
  filename: string;
  fileType?: string | null;
  content?: string;
  dataUrl?: string;
}

function bufferFromDocument(document: DocumentForExtraction) {
  const base64 = document.content || document.dataUrl?.split(",")[1] || "";
  return Buffer.from(base64, "base64");
}

function fileFromDocument(document: DocumentForExtraction) {
  const buffer = bufferFromDocument(document);
  return new File([buffer], document.filename, {
    type: document.fileType || undefined,
  });
}

export async function extractDocumentText(document: DocumentForExtraction) {
  const filename = document.filename.toLowerCase();
  const fileType = document.fileType?.toLowerCase();
  const buffer = bufferFromDocument(document);

  if (!buffer.length) return "";

  if (typeof File !== "undefined") {
    return (await extractFileContent(fileFromDocument(document))).trim();
  }

  if (fileType === "pdf" || filename.endsWith(".pdf")) {
    return (await extractPdfText(buffer)).trim();
  }

  if (fileType === "docx" || filename.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  return buffer.toString("utf8").trim();
}
