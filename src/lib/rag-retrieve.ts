/**
 * RAG retrieval — semantic search over document chunks, matter memory, and user memory.
 * @module rag-retrieve
 */

import { embedText } from "./embeddings";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export interface RetrievedChunk {
  id: string;
  documentName: string;
  chunkText: string;
  similarity: number;
  source: string;
  matterId: string | null;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  memoryType: string;
  similarity: number;
}

/**
 * Retrieve document chunks semantically matching a query.
 * Filters to similarity > 0.65.
 */
export async function retrieveRelevantChunks(params: {
  query: string;
  userId: string;
  matterId?: string;
  topK?: number;
}): Promise<RetrievedChunk[]> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const embedding = await embedText(params.query);
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(embedding),
      match_user_id: params.userId,
      match_count: params.topK || 5,
      match_matter_id: params.matterId || null,
    });

    if (error) {
      console.error("[rag-retrieve] match_document_chunks error:", error.message);
      return [];
    }

    return (data || [])
      .filter((row: { similarity: number }) => row.similarity > 0.65)
      .map((row: { id: string; document_name: string; chunk_text: string; similarity: number; source: string; matter_id: string | null }) => ({
        id: row.id,
        documentName: row.document_name,
        chunkText: row.chunk_text,
        similarity: row.similarity,
        source: row.source,
        matterId: row.matter_id,
      }));
  } catch (err) {
    console.error("[rag-retrieve] retrieveRelevantChunks failed:", err);
    return [];
  }
}

/**
 * Retrieve matter-specific memories matching a query.
 * Filters to similarity > 0.6.
 */
export async function retrieveMatterMemory(params: {
  query: string;
  matterId: string;
  topK?: number;
}): Promise<RetrievedMemory[]> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const embedding = await embedText(params.query);
    const { data, error } = await supabase.rpc("match_matter_memory", {
      query_embedding: JSON.stringify(embedding),
      match_matter_id: params.matterId,
      match_count: params.topK || 5,
    });

    if (error) {
      console.error("[rag-retrieve] match_matter_memory error:", error.message);
      return [];
    }

    return (data || [])
      .filter((row: { similarity: number }) => row.similarity > 0.6)
      .map((row: { id: string; content: string; memory_type: string; similarity: number }) => ({
        id: row.id,
        content: row.content,
        memoryType: row.memory_type,
        similarity: row.similarity,
      }));
  } catch (err) {
    console.error("[rag-retrieve] retrieveMatterMemory failed:", err);
    return [];
  }
}

/**
 * Retrieve user-level memories matching a query.
 * Filters to similarity > 0.6.
 */
export async function retrieveUserMemory(params: {
  query: string;
  userId: string;
  topK?: number;
}): Promise<RetrievedMemory[]> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const embedding = await embedText(params.query);
    const { data, error } = await supabase.rpc("match_user_memory", {
      query_embedding: JSON.stringify(embedding),
      match_user_id: params.userId,
      match_count: params.topK || 3,
    });

    if (error) {
      console.error("[rag-retrieve] match_user_memory error:", error.message);
      return [];
    }

    return (data || [])
      .filter((row: { similarity: number }) => row.similarity > 0.6)
      .map((row: { id: string; content: string; memory_type: string; similarity: number }) => ({
        id: row.id,
        content: row.content,
        memoryType: row.memory_type,
        similarity: row.similarity,
      }));
  } catch (err) {
    console.error("[rag-retrieve] retrieveUserMemory failed:", err);
    return [];
  }
}

/**
 * Format retrieved context for injection into the system prompt.
 * Returns empty string if all arrays are empty.
 */
export function formatRetrievedContext(
  chunks: RetrievedChunk[],
  matterMemory: RetrievedMemory[],
  userMemory: RetrievedMemory[]
): string {
  const sections: string[] = [];

  if (chunks.length > 0) {
    const formatted = chunks
      .map((c) => `[${c.documentName}] ${c.chunkText}`)
      .join("\n\n");
    sections.push(`\n\n## Relevant Documents (semantic search)\n${formatted}`);
  }

  if (matterMemory.length > 0) {
    const formatted = matterMemory.map((m) => `- ${m.content}`).join("\n");
    sections.push(`\n\n## Matter Context (from this case)\n${formatted}`);
  }

  if (userMemory.length > 0) {
    const formatted = userMemory.map((m) => `- ${m.content}`).join("\n");
    sections.push(`\n\n## User Context (remembered)\n${formatted}`);
  }

  return sections.join("");
}
