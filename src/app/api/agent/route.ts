/**
 * Agent Mode v2 API Route
 *
 * 7-step internal pipeline using Fable 5 (claude-fable-5) as the core
 * reasoning engine. Emits SSE progress events for the step tracker UI.
 *
 * Steps: parse → matter → search → fetch → tavily → synthesise → draft
 */

import { searchLegalDatabases, formatCasesForContext, tavilyIsWarranted, tavilyAdvancedSearch } from "@/lib/legal-search";
import { resolveCitation } from "@/lib/citation-resolver";
import { getConfiguredApiKey } from "@/lib/tauri-env";
import { getSessionUser, isBetaUser, isSupabaseConfigured } from "@/lib/supabase";
import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import { ANTHROPIC_MAX_MODEL, ANTHROPIC_ULTRA_MODEL } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEX_AGENT_SYSTEM_PROMPT = `You are Lex, a private AI legal counsel built into Vaultr. You have completed autonomous legal research. Deliver findings directly.

CITATIONS: Cite extensively. Every legal claim, statute reference, and case mention must be cited inline. Aim for 8-15 citations minimum. Format: Case Name [Year] Court Citation. For statutes: Act Name (Cap. X) s.XX. Never make a legal assertion without a citation.

RESPONSE STYLE:
- Answer directly. Never produce a memo format, "Memorandum" header, "Prepared by", "Subject:", or "Status:" fields unless the user explicitly asks for a memo or formal document.
- Lead with the direct answer in 1-2 sentences.
- Expand with analysis in clearly labelled ## sections.
- Cite cases inline: e.g. Uber BV v Aslam [2021] UKSC 5
- End with ## Recommended Next Steps with 3-5 concrete actions.
- Write as a senior lawyer speaking to a colleague — precise, direct, no unnecessary formality.
- Never open with "I" — lead with the substance.
- Always flag when analysis crosses jurisdictions.
- Never reproduce search process noise or database names.`;

const AGENT_MODEL = ANTHROPIC_MAX_MODEL; // claude-fable-5
const FALLBACK_MODEL = ANTHROPIC_ULTRA_MODEL; // claude-opus-4-8
const PIPELINE_TIMEOUT_MS = 180_000;
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

// tavilyIsWarranted is re-exported from @/lib/legal-search
// tavilyAdvancedSearch (in @/lib/legal-search) wraps the fetch with the
// shared in-memory cache so two callers asking the same query don't
// double-bill Tavily. We adapt its loose result shape (title/url/content
// optional) to the agent's strict WebResult contract.

async function tavilySearch(
  query: string,
  signal: AbortSignal
): Promise<{ answer?: string; results: WebResult[] }> {
  // Race the shared (cached) call against the request's abort signal so
  // an upstream disconnect still tears down the request promptly.
  const searchPromise = tavilyAdvancedSearch(query).then(({ answer, results }) => ({
    answer,
    results: results.map((r) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || "",
    })),
  }));
  const abortPromise = new Promise<{ answer?: string; results: WebResult[] }>((resolve) => {
    if (signal.aborted) return resolve({ results: [] });
    signal.addEventListener("abort", () => resolve({ results: [] }), { once: true });
  });
  return Promise.race([searchPromise, abortPromise]);
}

/* ------------------------------------------------------------------ */
/*  LLM call helper                                                    */
/* ------------------------------------------------------------------ */

async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: false,
  maxTokens?: number
): Promise<string>;
async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: true,
  maxTokens?: number
): Promise<Response>;
async function callFable5(
  systemPrompt: string,
  userMessage: string,
  model: string,
  signal: AbortSignal,
  stream: boolean,
  maxTokens?: number
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
      max_tokens: maxTokens || (stream ? 8192 : 2048),
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

  const contextParts: string[] = [];
  contextParts.push(`TASK: ${message}`);
  if (casesContext) contextParts.push(`LEGAL RESEARCH RESULTS:\n${casesContext}`);
  if (caseExcerpts) contextParts.push(`CASE EXCERPTS:\n${caseExcerpts}`);
  if (legalResults.wikiSummary) contextParts.push(`LEGAL CONTEXT:\n${legalResults.wikiSummary}`);
  if (webSearch.answer) contextParts.push(`WEB SEARCH SUMMARY:\n${webSearch.answer}`);
  if (webSearch.results.length > 0) {
    contextParts.push(`WEB SOURCES:\n${webSearch.results.slice(0, 5).map((r) => `- ${r.title}: ${r.content?.slice(0, 300) || ""}`).join("\n")}`);
  }
  if (detectedJurisdiction) contextParts.push(`Focus on ${detectedJurisdiction.toUpperCase()} jurisdiction where possible.`);
  const userMessageWithContext = contextParts.join("\n\n");

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
    response = await callFable5(LEX_AGENT_SYSTEM_PROMPT, userMessageWithContext, model, signal, true, 32000);
  } catch {
    // Fallback to claude-opus-4-8
    model = FALLBACK_MODEL;
    try {
      response = await callFable5(LEX_AGENT_SYSTEM_PROMPT, userMessageWithContext, model, signal, true, 32000);
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
  // Opportunistic cleanup: drop entries whose window has elapsed
  for (const [k, v] of agentRateLimitMap) {
    if (now - v.windowStart > 3_600_000) agentRateLimitMap.delete(k);
  }
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
