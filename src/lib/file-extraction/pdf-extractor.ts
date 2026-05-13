export async function extractPdfText(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}
