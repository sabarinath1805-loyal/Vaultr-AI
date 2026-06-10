/**
 * Agent Mode API Route
 *
 * Performs multi-step legal research: extracts sub-tasks, searches legal
 * databases, runs web search, resolves citations, then synthesises a
 * structured response.
 *
 * When HERMES_API_KEY is set, the entire orchestration is delegated to the
 * Hermes gateway.  When it is absent an internal pipeline runs locally.
 */

import { searchLegalDatabases, formatCasesForContext } from "@/lib/legal-search";
import { resolveCitation } from "@/lib/citation-resolver";
import { isHermesConfigured, runHermesAgent } from "@/lib/hermes";
import { getConfiguredApiKey } from "@/lib/tauri-env";
import { getSessionUser, isBetaUser, isSupabaseConfigured } from "@/lib/supabase";
import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import { ANTHROPIC_CORE_MODEL } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Streaming helpers                                                  */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder();

/** Encode a text chunk in Vercel AI Data-Stream v1 format. */
function encodeDataStreamText(text: string): Uint8Array {
  return encoder.encode(`0:${JSON.stringify(text)}\n`);
}

/** Send an agent step marker that the client can display as progress. */
function encodeAgentStep(step: string): Uint8Array {
  // Encode as a special data annotation the client can detect
  return encoder.encode(`2:${JSON.stringify([{ type: "agent_step", step }])}\n`);
}

/* ------------------------------------------------------------------ */
/*  Tavily web search (duplicated light version from chat route)       */
/* ------------------------------------------------------------------ */

interface WebResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(query: string): Promise<{ answer?: string; results: WebResult[] }> {
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
      signal: AbortSignal.timeout(15000),
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
/*  Internal agent pipeline                                            */
/* ------------------------------------------------------------------ */

async function runInternalPipeline(
  message: string,
  jurisdiction: string | undefined,
  model: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  abortSignal: AbortSignal
) {
  // Step 1 — Analyse task
  controller.enqueue(encodeAgentStep("Analysing task..."));
  // Give the client a moment to render the step
  await new Promise((r) => setTimeout(r, 200));

  // Step 2 — Search legal databases
  controller.enqueue(encodeAgentStep("Searching legal databases..."));
  const legalResults = await searchLegalDatabases(message, jurisdiction).catch(() => ({
    cases: [] as { title: string; citation: string; year: string; jurisdiction: string; court: string; summary: string; url: string; source: string }[],
    databases_searched: [] as string[],
    offline: false,
    wikiSummary: undefined as string | undefined,
  }));
  const casesContext = formatCasesForContext(legalResults.cases, 5);

  if (abortSignal.aborted) return;

  // Step 3 — Fetch case law via Tavily
  controller.enqueue(encodeAgentStep("Fetching case law..."));
  const webSearch = await tavilySearch(`${message} law legal`);

  // Try to resolve the top cited case for extra depth
  let citationExcerpt = "";
  if (legalResults.cases.length > 0) {
    const topCase = legalResults.cases[0];
    const excerpt = await resolveCitation(topCase.title).catch(() => null);
    if (excerpt) {
      citationExcerpt = `\n\n## Citation Excerpt — ${topCase.title}\n${excerpt.slice(0, 2000)}`;
    }
  }

  if (abortSignal.aborted) return;

  // Step 4 — Synthesise findings
  controller.enqueue(encodeAgentStep("Synthesising findings..."));

  // Build a comprehensive system prompt with all gathered context
  let systemMessage = `You are Lex Agent, Vaultr's deep legal research assistant. A lawyer has asked you to research a topic. You have already searched legal databases and the web. Synthesise ALL of the following context into a comprehensive, well-structured response.\n\nRespond with:\n1. A one-paragraph executive summary\n2. Key legal provisions and cases found\n3. Analysis of how they apply\n4. Open questions or areas requiring further research\n5. Recommended next steps\n\nCite all cases and statutes by their proper names.`;

  if (casesContext) {
    systemMessage += `\n${casesContext}`;
  }
  if (legalResults.wikiSummary) {
    systemMessage += `\n\n## Legal Context\n${legalResults.wikiSummary}`;
  }
  if (webSearch.answer) {
    systemMessage += `\n\n## Web Search Summary\n${webSearch.answer}`;
  }
  if (webSearch.results.length > 0) {
    systemMessage += `\n\n## Web Sources\n${webSearch.results
      .slice(0, 5)
      .map((r) => `- ${r.title}: ${r.content?.slice(0, 300) || ""}`)
      .join("\n")}`;
  }
  if (citationExcerpt) {
    systemMessage += citationExcerpt;
  }
  if (jurisdiction) {
    systemMessage += `\n\nFocus on ${jurisdiction.toUpperCase()} jurisdiction where possible.`;
  }

  if (abortSignal.aborted) return;

  // Step 5 — Draft response (stream from LLM)
  controller.enqueue(encodeAgentStep("Drafting response..."));

  const apiKey = getConfiguredApiKey("CLAUDEOPUS_API_KEY");
  if (!apiKey) {
    // No API key — return a mock/placeholder response
    const placeholder = buildPlaceholderResponse(message, legalResults, webSearch);
    controller.enqueue(encodeDataStreamText(placeholder));
    return;
  }

  // Stream from Claude
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.claudeopus.pro";
  const maxTokens = 8192;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: abortSignal,
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    // Fallback to placeholder on error
    const placeholder = buildPlaceholderResponse(message, legalResults, webSearch);
    controller.enqueue(encodeDataStreamText(placeholder));
    return;
  }

  // Pipe the SSE stream through to the client
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
          controller.enqueue(encodeDataStreamText(token));
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
  // Flush remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        const token = parsed.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token.length > 0) {
          controller.enqueue(encodeDataStreamText(token));
        }
      } catch {
        // Ignore
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Placeholder response when no LLM key is configured                 */
/* ------------------------------------------------------------------ */

function buildPlaceholderResponse(
  message: string,
  legalResults: { cases: { title: string; citation: string }[]; databases_searched: string[] },
  webSearch: { answer?: string; results: WebResult[] }
): string {
  const parts: string[] = [];
  parts.push(`# Agent Research Report\n\n**Query:** ${message}\n`);

  if (legalResults.cases.length > 0) {
    parts.push(`## Legal Database Results (${legalResults.databases_searched.join(", ")})\n`);
    for (const c of legalResults.cases.slice(0, 5)) {
      parts.push(`- **${c.title}**${c.citation ? ` [${c.citation}]` : ""}`);
    }
    parts.push("");
  } else {
    parts.push("## Legal Database Results\nNo cases found in the searched databases.\n");
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

  parts.push("---\n*Note: Full AI synthesis is unavailable because no LLM API key is configured. Configure CLAUDEOPUS_API_KEY in Settings to enable rich agent responses.*");
  return parts.join("\n");
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
  const matterId: string | undefined =
    typeof body.matterId === "string" ? body.matterId : undefined;
  const model: string =
    typeof body.model === "string" ? body.model : ANTHROPIC_CORE_MODEL;

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

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rl = checkRateLimit(clientIp, model);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: rl.message || "Rate limit exceeded" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  // ---- Hermes path ----
  if (isHermesConfigured()) {
    try {
      const hermesStream = await runHermesAgent(
        { message, jurisdiction, matterId, model },
        abortController.signal
      );
      return new Response(hermesStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
        },
      });
    } catch (err) {
      console.error("[Agent] Hermes error, falling back to internal pipeline:", err);
      // Fall through to internal pipeline
    }
  }

  // ---- Internal pipeline path ----
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runInternalPipeline(
          message,
          jurisdiction,
          model,
          controller,
          abortController.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[Agent] Internal pipeline error:", err);
          controller.enqueue(
            encodeDataStreamText(
              "Agent encountered an error. Please try again or switch to regular chat."
            )
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  recordUsage(clientIp, model);
  void (authenticatedUserId); // will be used for usage logging in future

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
