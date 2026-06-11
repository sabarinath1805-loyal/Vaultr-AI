/**
 * Voyage AI embeddings for legal-specific semantic search.
 * Model: voyage-law-2 (1024 dimensions, legal-optimized).
 * @module embeddings
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-law-2";
const MAX_BATCH_SIZE = 128;

function getVoyageApiKey(): string {
  const key = process.env.VOYAGE_API_KEY?.trim();
  if (!key) throw new Error("VOYAGE_API_KEY is not configured");
  return key;
}

/**
 * Embed a query string for similarity search.
 * Uses input_type="query" for retrieval-optimised embeddings.
 */
export async function embedText(text: string): Promise<number[]> {
  const [result] = await embedBatch([text], "query");
  return result;
}

/**
 * Embed a document chunk for indexing.
 * Uses input_type="document" for storage-optimised embeddings.
 */
export async function embedDocument(text: string): Promise<number[]> {
  const [result] = await embedBatch([text], "document");
  return result;
}

/**
 * Batch embed up to 128 texts per Voyage API request.
 * Automatically splits into multiple requests if texts exceed MAX_BATCH_SIZE.
 */
export async function embedBatch(
  texts: string[],
  inputType: "query" | "document" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getVoyageApiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch,
        input_type: inputType,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Voyage API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const embeddings = (data.data as { embedding: number[] }[]) || [];
    for (const item of embeddings) {
      results.push(item.embedding);
    }
  }

  return results;
}

/**
 * Split text into overlapping word-level chunks for embedding.
 * Chunks smaller than 50 characters are discarded.
 */
export function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 64
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.length >= 50) {
      chunks.push(chunk);
    }
    if (end >= words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}
