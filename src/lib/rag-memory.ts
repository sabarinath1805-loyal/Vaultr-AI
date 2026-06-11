/**
 * Memory write layer — extracts and stores per-matter and per-user memories.
 * Uses Claude Haiku for extraction, Voyage for embeddings, Supabase for storage.
 * @module rag-memory
 */

import { embedDocument } from "./embeddings";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Save a matter-level memory with embedding.
 */
export async function saveMatterMemory(params: {
  matterId: string;
  userId: string;
  content: string;
  memoryType: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const embedding = await embedDocument(params.content);
  await supabase.from("matter_memory").insert({
    matter_id: params.matterId,
    user_id: params.userId,
    content: params.content,
    memory_type: params.memoryType,
    embedding: JSON.stringify(embedding),
  });
}

/**
 * Save a user-level memory with embedding.
 * Checks for exact duplicate before inserting.
 */
export async function saveUserMemory(params: {
  userId: string;
  content: string;
  memoryType: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  // Check for exact duplicate
  const { data: existing } = await supabase
    .from("user_memory")
    .select("id")
    .eq("user_id", params.userId)
    .eq("content", params.content)
    .limit(1);

  if (existing && existing.length > 0) return;

  const embedding = await embedDocument(params.content);
  await supabase.from("user_memory").insert({
    user_id: params.userId,
    content: params.content,
    memory_type: params.memoryType,
    embedding: JSON.stringify(embedding),
  });
}

/**
 * Extract and save memories from a conversation turn.
 * Uses Claude Haiku via ClaudeOpus.pro with 8s timeout.
 * Fire-and-forget — all errors caught silently.
 */
export async function extractAndSaveMemories(params: {
  userId: string;
  matterId?: string;
  userMessage: string;
  lexResponse: string;
  claudeOpusApiKey: string;
  baseUrl: string;
}): Promise<void> {
  try {
    const response = await fetch(`${params.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.claudeOpusApiKey}`,
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content:
              "Extract memorable facts from this conversation turn that would be useful context in future conversations. Return ONLY valid JSON with this structure: { \"user_memories\": [\"string\", ...], \"matter_memories\": [\"string\", ...] }. Max 2 user memories and 3 matter memories. User memories are general preferences or facts about the user. Matter memories are specific to the legal case being discussed. If nothing is worth remembering, return empty arrays. ONLY return valid JSON, no markdown fences.",
          },
          {
            role: "user",
            content: `User message: ${params.userMessage.slice(0, 1000)}\n\nLex response: ${params.lexResponse.slice(0, 2000)}`,
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return;

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return;

    let parsed: { user_memories?: string[]; matter_memories?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const userMemories = Array.isArray(parsed.user_memories)
      ? parsed.user_memories.filter((m): m is string => typeof m === "string" && m.length > 10).slice(0, 2)
      : [];
    const matterMemories = Array.isArray(parsed.matter_memories)
      ? parsed.matter_memories.filter((m): m is string => typeof m === "string" && m.length > 10).slice(0, 3)
      : [];

    const saves: Promise<void>[] = [];

    for (const content of userMemories) {
      saves.push(
        saveUserMemory({
          userId: params.userId,
          content,
          memoryType: "conversation_extract",
        })
      );
    }

    if (params.matterId) {
      for (const content of matterMemories) {
        saves.push(
          saveMatterMemory({
            matterId: params.matterId,
            userId: params.userId,
            content,
            memoryType: "conversation_extract",
          })
        );
      }
    }

    await Promise.allSettled(saves);
  } catch {
    // Fire-and-forget — silently ignore all errors
  }
}
