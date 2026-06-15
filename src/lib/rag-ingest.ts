/**
 * Document ingestion pipeline for RAG.
 * Chunks text, embeds via Voyage, and stores in Supabase pgvector.
 * @module rag-ingest
 */

import { chunkText, embedBatch } from "./embeddings";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export interface IngestParams {
  userId: string;
  matterId?: string;
  documentName: string;
  content: string;
  source?: string;
}

export interface IngestResult {
  chunksInserted: number;
  error?: string;
}

/**
 * Ingest a document: chunk, embed, and store in document_chunks.
 * Deletes existing chunks for the same document before re-ingesting.
 * Fire-and-forget safe — all errors caught and logged.
 */
export async function ingestDocument(params: IngestParams): Promise<IngestResult> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return { chunksInserted: 0, error: "Supabase not configured" };
    }

    if (!params.content?.trim()) {
      return { chunksInserted: 0, error: "No content to ingest" };
    }

    // Delete existing chunks for this document
    await supabase
      .from("document_chunks")
      .delete()
      .eq("user_id", params.userId)
      .eq("document_name", params.documentName);

    const chunks = chunkText(params.content);
    if (chunks.length === 0) {
      return { chunksInserted: 0 };
    }

    // Batch embed all chunks
    const embeddings = await embedBatch(chunks, "retrieval.passage");

    // Insert all rows
    const rows = chunks.map((text, index) => ({
      user_id: params.userId,
      matter_id: params.matterId || null,
      document_name: params.documentName,
      chunk_index: index,
      chunk_text: text,
      embedding: JSON.stringify(embeddings[index]),
      source: params.source || "vault",
    }));

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) {
      console.error("[rag-ingest] Insert failed:", error.message);
      return { chunksInserted: 0, error: error.message };
    }

    return { chunksInserted: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rag-ingest] ingestDocument failed:", message);
    return { chunksInserted: 0, error: message };
  }
}
