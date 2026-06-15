/**
 * Jina AI embeddings for legal semantic search.
 * Model: jina-embeddings-v3 (1024 dimensions, supports Matryoshka truncation).
 * @module embeddings
 */

const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v3";
const JINA_DIMENSIONS = 1024;
const MAX_BATCH_SIZE = 128;

function getJinaApiKey(): string {
  const key = process.env.JINA_API_KEY?.trim();
  if (!key) throw new Error("JINA_API_KEY is not configured");
  return key;
}

/**
 * Embed a query string for similarity search.
 * Uses task="retrieval.query" for retrieval-optimised embeddings.
 */
export async function embedText(text: string): Promise<number[]> {
  const [result] = await embedBatch([text], "retrieval.query");
  return result;
}

/**
 * Embed a document chunk for indexing.
 * Uses task="retrieval.passage" for storage-optimised embeddings.
 */
export async function embedDocument(text: string): Promise<number[]> {
  const [result] = await embedBatch([text], "retrieval.passage");
  return result;
}

type JinaTask =
  | "retrieval.query"
  | "retrieval.passage"
  | "text-matching"
  | "classification"
  | "separation";

/**
 * Batch embed up to 128 texts per Jina API request.
 * Automatically splits into multiple requests if texts exceed MAX_BATCH_SIZE.
 * `normalized: true` produces unit-length vectors — required for cosine via dot product
 * and matches how pgvector's `vector_cosine_ops` measures distance.
 */
export async function embedBatch(
  texts: string[],
  task: JinaTask = "retrieval.passage"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getJinaApiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        input: batch,
        normalized: true,
        embedding_type: "float",
        dimensions: JINA_DIMENSIONS,
        task,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Jina API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const embeddings = (data.data as { embedding: number[]; index: number }[]) || [];
    // Sort by index because Jina may return results in input order, but we want to be safe.
    embeddings.sort((a, b) => a.index - b.index);
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
