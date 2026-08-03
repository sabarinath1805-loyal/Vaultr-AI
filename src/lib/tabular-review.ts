import { getConfiguredApiKey } from './tauri-env';

/** Extract one requested fact from a document cell using the configured model. */
export async function analyseCell(params: {
  documentText: string;
  columnQuestion: string;
  documentName: string;
}): Promise<string> {
  const apiKey = getConfiguredApiKey('CLAUDEOPUS_API_KEY');
  if (!apiKey) throw new Error('Missing CLAUDEOPUS_API_KEY');

  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.claudeopus.pro';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'You are a legal AI. Extract the specific information requested from this legal document. Be concise — answer in 1-3 sentences maximum. If the information is not present in the document, respond with "Not specified".',
          },
          {
            role: 'user',
            content: `Document: ${params.documentText.slice(0, 8000)}\n\nQuestion: ${params.columnQuestion}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Analysis failed: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Not specified';
  } finally {
    clearTimeout(timer);
  }
}
