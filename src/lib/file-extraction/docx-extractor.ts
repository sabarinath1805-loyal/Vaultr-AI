import mammoth from "mammoth";

/** Extract plain text from a DOCX buffer. */
export async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
