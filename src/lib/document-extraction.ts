/**
 * Document text extraction utilities.
 * Supports PDF, DOCX, and plain text files, with caching of pre-extracted text.
 * @module document-extraction
 */

import mammoth from "mammoth";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import { extractFileContent } from "@/lib/extract-file-content";

/**
 * A document ready for text extraction.
 * @interface DocumentForExtraction
 * @property {string} filename - The original filename including extension.
 * @property {string | null} [fileType] - MIME type (e.g., "application/pdf").
 * @property {string} [extractedText] - Pre-extracted text for caching.
 * @property {string} [content] - Base64-encoded content.
 * @property {string} [dataUrl] - data: URL containing Base64 content.
 */
interface DocumentForExtraction {
  filename: string;
  fileType?: string | null;
  extractedText?: string;
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

/**
 * Extract text content from a document.
 * Tries pre-extracted text if available, otherwise extracts based on file type.
 * @param document - The document to extract text from.
 * @returns Extracted text content, or empty string on failure.
 */
export async function extractDocumentText(document: DocumentForExtraction) {
  if (document.extractedText?.trim()) return document.extractedText.trim();

  const filename = document.filename.toLowerCase();
  const fileType = document.fileType?.toLowerCase();
  const buffer = bufferFromDocument(document);

  if (!buffer.length) return "";

  try {
    if (fileType === "pdf" || filename.endsWith(".pdf")) {
      return (await extractPdfText(buffer)).trim();
    }

    if (fileType === "docx" || filename.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    if (typeof File !== "undefined") {
      return (await extractFileContent(fileFromDocument(document))).trim();
    }

    return buffer.toString("utf8").trim();
  } catch (error) {
    console.error(`Document extraction failed for ${document.filename}:`, error);
    return "";
  }
}
