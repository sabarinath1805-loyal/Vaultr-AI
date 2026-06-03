// Docx generation utility for Vaultr
// Generates downloadable .docx documents from structured sections

export interface DocxSection {
  heading: string;
  content?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface DocxGenerateRequest {
  title: string;
  sections: DocxSection[];
  filename: string;
  landscape?: boolean;
}

export interface DocxGenerateResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
}

export async function generateDocx(params: DocxGenerateRequest): Promise<DocxGenerateResponse> {
  const response = await fetch("/api/generate-docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Docx generation failed: ${response.status}`);
  }
  return response.json();
}
