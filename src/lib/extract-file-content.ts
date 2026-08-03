import mammoth from "mammoth";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";

/** Extract text from a supported browser `File` object. */
export async function extractFileContent(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "txt" || ext === "md") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    return extractPdfText(buffer);
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}
