/**
 * Agent Mode v2 API Route
 *
 * 7-step internal pipeline using Fable 5 (claude-fable-5) as the core
 * reasoning engine. Emits SSE progress events for the step tracker UI.
 *
 * Steps: parse → matter → search → fetch → tavily → synthesise → draft
 */

import { searchLegalDatabases, formatCasesForContext } from "@/lib/legal-search";
import { resolveCitation } from "@/lib/citation-resolver";
import { getConfiguredApiKey } from "@/lib/tauri-env";
import { getSessionUser, isBetaUser, isSupabaseConfigured } from "@/lib/supabase";
import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import { ANTHROPIC_MAX_MODEL, ANTHROPIC_ULTRA_MODEL } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_MODEL = ANTHROPIC_MAX_MODEL; // claude-fable-5
const FALLBACK_MODEL = ANTHROPIC_ULTRA_MODEL; // claude-opus-4-8
const PIPELINE_TIMEOUT_MS = 60_000;
const AGENT_RATE_LIMIT_PER_HOUR = 10;

/* ------------------------------------------------------------------ */
/*  Streaming helpers                                                  */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder();

function encodeText(text: string): Uint8Array {
  return encoder.encode(`0:${JSON.stringify(text)}\n`);
}

function encodeProgress(step: string, status: "active" | "done"): Uint8Array {
  return encoder.encode(
    `2:${JSON.stringify([{ type: "agent_step", step, status }])}\n`
  );
}

/* ------------------------------------------------------------------ */
/*  Tavily web search                                                  */
/* ------------------------------------------------------------------ */

interface WebResult {
  title: string;
  url: string;
  content: string;
}

function tavilyIsWarranted(message: string): boolean {
  const normalized = message.toLowerCase();
  const recencySignals = [
    /\brecent(ly)?\b/i, /\blatest\b/i, /\bcurrent(ly)?\b/i, /\btoday\b/i,
    /\b20(2[3-9]|[3-9]\d)\b/, /\bnew\b/i, /\bupdate[ds]?\b/i,
    /\bbreaking\b/i, /\bnews\b/i, /\btrend/i,
  ];
  return recencySignals.some((r) => r.test(normalized));
}

async function tavilySearch(
  query: string,
  signal: AbortSignal
): Promise<{ answer?: string; results: WebResult[] }> {
  const apiKey = getConfiguredApiKey("TAVILY_API_KEY");
  if (!apiKey?.trim()) return { results: [] };

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      }),
      signal,
    });
    if (!response.ok) return { results: [] };
    const data = await response.json();
    return {
      answer: data.answer || undefined,
      results: Array.isArray(data.results) ? data.results : [],
    };
  } catch {
    return { results: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  LLM call helper                                                    */
/* ------------------------------------------------------------------ */

async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: false
): Promise<string>;
async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: true
): Promise<Response>;
async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: boolean
): Promise<string | Response> {
  const apiKey = getConfiguredApiKey("CLAUDEOPUS_API_KEY");
  if (!apiKey) throw new Error("CLAUDEOPUS_API_KEY not configured");

  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.claudeopus.pro";
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      stream,
      max_tokens: stream ? 8192 : 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM error: ${response.status}`);
  }

  if (stream) return response;

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/* ------------------------------------------------------------------ */
/*  Agent pipeline                                                     */
/* ------------------------------------------------------------------ */

type LegalCase = {
  title: string;
  citation: string;
  year: string;
  jurisdiction: string;
  court: string;
  summary: string;
  url: string;
  source: string;
};

async function runAgentPipeline(
  message: string,
  jurisdiction: string | undefined,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal
) {
  let extractedQuery = message;
  let detectedJurisdiction = jurisdiction;
  const apiKey = getConfiguredApiKey("CLAUDEOPUS_API_KEY");

  // Step 1 — Parse goal
  controller.enqueue(encodeProgress("parse", "active"));
  try {
    if (apiKey) {
      const parseResult = await callFable5(
        "Extract from this lawyer's request: (1) the main task type [research/draft/review/analyse], (2) key legal topics as a search query, (3) jurisdictions mentioned or implied. Return JSON: {\"taskType\":\"...\",\"searchQuery\":\"...\",\"jurisdiction\":\"...\"}",
        message,
        AGENT_MODEL,
        signal,
        false
      );
      try {
        const jsonMatch = parseResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.searchQuery) extractedQuery = parsed.searchQuery;
          if (parsed.jurisdiction && !detectedJurisdiction) {
            detectedJurisdiction = parsed.jurisdiction;
          }
        }
      } catch {
        // Use original message as search query
      }
    }
  } catch {
    // Parse step failed, continue with original message
  }
  controller.enqueue(encodeProgress("parse", "done"));
  if (signal.aborted) return;

  // Step 2 — Read matter context (client-side only, emit done immediately)
  controller.enqueue(encodeProgress("matter", "active"));
  controller.enqueue(encodeProgress("matter", "done"));
  if (signal.aborted) return;

  // Step 3 — Legal database search
  controller.enqueue(encodeProgress("search", "active"));
  const legalResults = await searchLegalDatabases(
    extractedQuery,
    detectedJurisdiction
  ).catch(() => ({
    cases: [] as LegalCase[],
    databases_searched: [] as string[],
    offline: false,
    wikiSummary: undefined as string | undefined,
  }));
  const casesContext = formatCasesForContext(legalResults.cases, 10);
  controller.enqueue(encodeProgress("search", "done"));
  if (signal.aborted) return;

  // Step 4 — Fetch case excerpts
  controller.enqueue(encodeProgress("fetch", "active"));
  const topCases = legalResults.cases.slice(0, 5);
  const excerptPromises = topCases.map((c) =>
    resolveCitation(c.title)
      .then((text) => ({ title: c.title, text: text?.slice(0, 2000) || "" }))
      .catch(() => ({ title: c.title, text: "" }))
  );
  const excerpts = await Promise.allSettled(excerptPromises);
  const caseExcerpts = excerpts
    .filter(
      (r): r is PromiseFulfilledResult<{ title: string; text: string }> =>
        r.status === "fulfilled" && r.value.text.length > 0
    )
    .map((r) => `### ${r.value.title}\n${r.value.text}`)
    .join("\n\n");
  controller.enqueue(encodeProgress("fetch", "done"));
  if (signal.aborted) return;

  // Step 5 — Web search (only if warranted)
  controller.enqueue(encodeProgress("tavily", "active"));
  let webSearch: { answer?: string; results: WebResult[] } = { results: [] };
  if (tavilyIsWarranted(message)) {
    webSearch = await tavilySearch(message, signal);
  }
  controller.enqueue(encodeProgress("tavily", "done"));
  if (signal.aborted) return;

  // Step 6 — Synthesise
  controller.enqueue(encodeProgress("synthesise", "active"));

  const systemPrompt = buildSynthesisPrompt(
    message,
    casesContext,
    caseExcerpts,
    legalResults.wikiSummary,
    webSearch,
    detectedJurisdiction
  );

  controller.enqueue(encodeProgress("synthesise", "done"));

  // Step 7 — Draft response
  controller.enqueue(encodeProgress("draft", "active"));

  if (!apiKey) {
    const placeholder = buildPlaceholderResponse(message, legalResults, webSearch);
    controller.enqueue(encodeText(placeholder));
    controller.enqueue(encodeProgress("draft", "done"));
    return;
  }

  let model = AGENT_MODEL;
  let response: Response;
  try {
    response = await callFable5(systemPrompt, message, model, signal, true);
  } catch {
    // Fallback to claude-opus-4-8
    model = FALLBACK_MODEL;
    try {
      response = await callFable5(systemPrompt, message, model, signal, true);
    } catch {
      const placeholder = buildPlaceholderResponse(message, legalResults, webSearch);
      controller.enqueue(encodeText(placeholder));
      controller.enqueue(encodeProgress("draft", "done"));
      return;
    }
  }

  if (!response.body) {
    controller.enqueue(encodeText("Agent failed to generate a response."));
    controller.enqueue(encodeProgress("draft", "done"));
    return;
  }

  // Stream LLM response
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const token = parsed.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token.length > 0) {
          controller.enqueue(encodeText(token));
        }
      } catch {
        // Skip unparseable
      }
    }
  }
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        const token = parsed.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token.length > 0) {
          controller.enqueue(encodeText(token));
        }
      } catch {
        // Ignore
      }
    }
  }
  controller.enqueue(encodeProgress("draft", "done"));
}

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

function buildSynthesisPrompt(
  task: string,
  casesContext: string,
  caseExcerpts: string,
  wikiSummary: string | undefined,
  webSearch: { answer?: string; results: WebResult[] },
  jurisdiction: string | undefined
): string {
  let prompt = `You are Lex, an expert legal AI agent. You have been given a research task by a lawyer.
Complete the task thoroughly and autonomously. Deliver a finished, professional work product.

TASK: ${task}
`;

  if (casesContext) {
    prompt += `\nLEGAL RESEARCH RESULTS:\n${casesContext}\n`;
  }
  if (caseExcerpts) {
    prompt += `\nCASE EXCERPTS:\n${caseExcerpts}\n`;
  }
  if (wikiSummary) {
    prompt += `\nLEGAL CONTEXT:\n${wikiSummary}\n`;
  }
  if (webSearch.answer) {
    prompt += `\nWEB SEARCH SUMMARY:\n${webSearch.answer}\n`;
  }
  if (webSearch.results.length > 0) {
    prompt += `\nWEB SOURCES:\n${webSearch.results
      .slice(0, 5)
      .map((r) => `- ${r.title}: ${r.content?.slice(0, 300) || ""}`)
      .join("\n")}\n`;
  }
  if (jurisdiction) {
    prompt += `\nFocus on ${jurisdiction.toUpperCase()} jurisdiction where possible.\n`;
  }

  prompt += `
INSTRUCTIONS:
- Deliver a complete, finished work product — not a chat reply
- Structure your response professionally with clear headings
- Cite every case and statute used using [1], [2] format
- End with a ## Sources section listing all citations
- If drafting a document, format it as a proper legal document
- Be thorough — this is an autonomous agent task, not a quick answer`;

  return prompt;
}

/* ------------------------------------------------------------------ */
/*  Placeholder response when no LLM key is configured                 */
/* ------------------------------------------------------------------ */

function buildPlaceholderResponse(
  message: string,
  legalResults: { cases: LegalCase[]; databases_searched: string[] },
  webSearch: { answer?: string; results: WebResult[] }
): string {
  const parts: string[] = [];
  parts.push(`# Agent Research Report\n\n**Query:** ${message}\n`);

  if (legalResults.cases.length > 0) {
    parts.push(
      `## Legal Database Results (${legalResults.databases_searched.join(", ")})\n`
    );
    for (const c of legalResults.cases.slice(0, 5)) {
      parts.push(`- **${c.title}**${c.citation ? ` [${c.citation}]` : ""}`);
    }
    parts.push("");
  } else {
    parts.push(
      "## Legal Database Results\nNo cases found in the searched databases.\n"
    );
  }

  if (webSearch.answer) {
    parts.push(`## Web Search Summary\n${webSearch.answer}\n`);
  }
  if (webSearch.results.length > 0) {
    parts.push("## Web Sources");
    for (const r of webSearch.results.slice(0, 3)) {
      parts.push(`- [${r.title}](${r.url})`);
    }
    parts.push("");
  }

  parts.push(
    "---\n*Note: Full AI synthesis is unavailable because no LLM API key is configured. Configure CLAUDEOPUS_API_KEY in Settings to enable rich agent responses.*"
  );
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Rate limit — agent-specific (10 per hour per user/IP)              */
/* ------------------------------------------------------------------ */

const agentRateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkAgentRateLimit(key: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const entry = agentRateLimitMap.get(key);
  if (!entry || now - entry.windowStart > 3_600_000) {
    agentRateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (entry.count >= AGENT_RATE_LIMIT_PER_HOUR) {
    return { allowed: false, message: "Agent rate limit exceeded (10 requests per hour)." };
  }
  entry.count++;
  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  // Size guard
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 100 * 1024) {
    return new Response(
      JSON.stringify({ error: "Request body too large." }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const message: string = typeof body.message === "string" ? body.message : "";
  const jurisdiction: string | undefined =
    typeof body.jurisdiction === "string" ? body.jurisdiction : undefined;

  if (!message.trim()) {
    return new Response(
      JSON.stringify({ error: "Message is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Supabase auth gate
  let authenticatedUserId: string | null = null;
  if (isSupabaseConfigured()) {
    const authHeader = req.headers.get("authorization");
    // TODO: remove dev bypass before beta launch
    if (process.env.NODE_ENV === "development" && !authHeader) {
      authenticatedUserId = "00000000-0000-0000-0000-000000000001";
    } else {
      const user = await getSessionUser(authHeader);
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required." }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      const approved = await isBetaUser(user.email || "");
      if (!approved) {
        return new Response(
          JSON.stringify({ error: "Beta approval pending." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      authenticatedUserId = user.id;
    }
  }

  // Rate limiting — agent-specific
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateLimitKey = authenticatedUserId || clientIp;
  const agentRl = checkAgentRateLimit(rateLimitKey);
  if (!agentRl.allowed) {
    return new Response(
      JSON.stringify({ error: agentRl.message }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Also run the standard rate limiter
  const rl = checkRateLimit(clientIp, AGENT_MODEL);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: rl.message || "Rate limit exceeded" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  // 60 second timeout
  const timeoutId = setTimeout(() => abortController.abort(), PIPELINE_TIMEOUT_MS);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runAgentPipeline(
          message,
          jurisdiction,
          controller,
          abortController.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[Agent] Pipeline error:", err);
          controller.enqueue(
            encodeText(
              "\n\n---\n*Agent encountered an error. Some results may be partial.*"
            )
          );
        }
      } finally {
        clearTimeout(timeoutId);
        controller.close();
      }
    },
  });

  recordUsage(clientIp, AGENT_MODEL);
  void authenticatedUserId;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
