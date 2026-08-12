export const MAX_DOCUMENT_TEXT_CHARS = 2_000_000;
export const MAX_PDF_PAGES = 500;
export const MAX_SPREADSHEET_CELLS = 100_000;
export const MAX_PRESENTATION_SLIDES = 500;

export function enforceTextLimit(text: string, context: string) {
  if (text.length > MAX_DOCUMENT_TEXT_CHARS) {
    throw new Error(`${context} exceeds the extracted text limit`);
  }
  return text;
}
