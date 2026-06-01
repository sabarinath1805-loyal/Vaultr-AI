import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createOllama } from "ollama-ai-provider";
import { streamText, type CoreMessage } from "ai";
import {
  GROQ_DEFAULT_MODEL,
  isCloudModel,
  isGeminiModel,
  isLexModel,
} from "@/lib/models";
import { extractDocumentText } from "@/lib/document-extraction";
import {
  createThinkStripState,
  flushThinkStripState,
  stripAssistantMarkup,
  stripAssistantStreamChunk,
} from "@/lib/chat-message-content";
import { getConfiguredApiKey } from "@/lib/tauri-env";
import { searchLegalDatabases, formatCasesForContext } from "@/lib/legal-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_TRIGGERS = [
  "research",
  "search",
  "find",
  "look up",
  "lookup",
  "latest",
  "recent",
  "news",
  "today",
  "current",
  "regulation",
  "regulations",
  "notice",
  "notices",
  "case",
  "cases",
  "filing",
  "procedure",
  "procedures",
  "form",
  "forms",
  "deadline",
  "deadlines",
];

const NO_SEARCH_TRIGGERS = [
  "definition",
  "define",
  "what is",
  "explain",
  "general principle",
  "common law",
  "settled law",
];

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const SYSTEM_PROMPT_LEAK_REGEX = /(?:^|\n)\s*-?\s*[\(\["“']?\s*(?:Open with a direct one-sentence verdict[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Break into clearly labelled sections[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|End with a ["“]?Recommended Next Steps["”]? section[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Simple questions and greetings[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Complex legal analysis[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Will perform web search[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Search query:[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Search results[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|I'll simulate[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Searching\.\.\.[^\n]*(?:[\)\]"”']?\s*(?:\n|$)))/gi;
const LEX_IDENTITY_LEAK_REGEX = /(?:^|\n)\s*(?:You are Lex, a private AI legal assistant built into Vaultr[^\n]*(?:\n|$)|PERSONALITY:\s*(?:\n|$)|RESPONSE STYLE:\s*(?:\n|$))/gi;

const WEB_SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, case law, regulations, and legal news",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },
];

interface WebSearchSource {
  title: string;
  url: string;
  domain: string;
}

export async function POST(req: Request) {
  const {
    messages,
    selectedModel,
    data,
    workflow,
    attachedDocuments,
    thinkingMode,
    thinking,
    workflowPrompt,
    usePrivacyMode,
    ollamaUrl: requestedOllamaUrl,
    jurisdictionPrompt,
  } = await req.json();
  const privacyMode = usePrivacyMode === true;
  const requestedModel = typeof selectedModel === "string" ? selectedModel : null;
  if (privacyMode && !isLexModel(requestedModel)) {
    return new Response(
      `0:${JSON.stringify("LEX_MODEL_REQUIRED")}\n`,
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
        },
      }
    );
  }
  const ollamaUrl = requestedOllamaUrl || process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  const cloudModel = isCloudModel(requestedModel)
    ? requestedModel
    : process.env.GROQ_DEFAULT_MODEL || GROQ_DEFAULT_MODEL;
  const activeModel = privacyMode ? requestedModel : cloudModel;
  const geminiModel = GEMINI_MODELS.includes(activeModel || "") && isGeminiModel(activeModel)
    ? activeModel
    : null;

  const conversationMessages = Array.isArray(messages) ? messages : [];
  const initialMessages = sanitizeChatMessages(conversationMessages.slice(0, -1));
  const currentMessage = conversationMessages[conversationMessages.length - 1];
  const userMessage =
    typeof currentMessage?.content === "string" ? currentMessage.content : "";
  const shouldSearch = !privacyMode && shouldUseWebSearch(userMessage);
  const webSearch = shouldSearch
    ? await getWebSearchContext(userMessage)
    : { context: "", sources: [] };
  const workflowTemplatePrompt =
    typeof workflowPrompt === "string" && workflowPrompt.trim()
      ? workflowPrompt.trim()
      : workflow?.prompt || "";
  const documentContexts = Array.isArray(attachedDocuments)
    ? await Promise.all(
        attachedDocuments.map(
          async (document: {
            filename: string;
            fileType?: string | null;
            extractedText?: string;
            content?: string;
            dataUrl?: string;
          }) => {
            let extractedText = "";
            try {
              extractedText = await extractDocumentText(document);
            } catch (error) {
              console.error(`Failed to extract text from ${document.filename}:`, error);
            }
            if (!extractedText) return "";
            return `\n\nThe user has attached a document titled '${document.filename}'. Here is the full content:\n\n---BEGIN DOCUMENT---\n${extractedText}\n---END DOCUMENT---\n\nAnswer the user's question based on this document. If they say "analyse this" or similar, provide a thorough analysis of the document content above.`;
          }
        )
      )
    : [];
  const documentContext = documentContexts.filter(Boolean).join("");
  const thinkingEnabled =
    typeof thinkingMode === "boolean" ? thinkingMode : thinking === true;
  const usesCloudReasoning = !privacyMode && activeModel === "qwen/qwen3-32b";
  const recentDataFallback =
    "\n\nIf asked about recent events or news and you don't have real-time data, respond in one sentence: \"I don't have real-time data on that — want me to search?\" Do not write a long explanation about your training cutoff.";
  const baseSystemPrompt =
    LEX_SYSTEM_PROMPT +
    (shouldSearch ? "" : recentDataFallback) +
    (thinkingEnabled || usesCloudReasoning ? "" : "\n\n/no_think");
  const finalSystemPrompt = workflowTemplatePrompt
    ? `${workflowTemplatePrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;
  const jurisdictionContext = typeof jurisdictionPrompt === "string" && jurisdictionPrompt.trim()
    ? jurisdictionPrompt.trim()
    : "";
  // Run legal database search in parallel (non-blocking)
  const legalSearchPromise = !privacyMode
    ? searchLegalDatabases(userMessage).catch(() => ({ cases: [], databases_searched: [], offline: false }))
    : Promise.resolve({ cases: [], databases_searched: [], offline: false });

  // Await legal results before building system message (fast due to parallel execution)
  const legalResults = await legalSearchPromise;
  const legalContext = formatCasesForContext(legalResults.cases);

  const systemMessage = `${finalSystemPrompt}${documentContext}${webSearch.context}${jurisdictionContext ? "\n\n" + jurisdictionContext : ""}${legalContext}`;
  const userContent = data?.images?.length
    ? [
        { type: "text", text: userMessage },
        ...data.images.map((imageUrl: string) => ({
          type: "image_url",
          image_url: { url: imageUrl },
        })),
      ]
    : userMessage;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 120_000);

  try {
    if (!privacyMode && geminiModel) {
      const response = await streamGeminiResponse({
        model: geminiModel,
        systemMessage,
        initialMessages,
        userMessage,
        shouldSearch,
        searchSources: webSearch.sources,
        activeModel,
        attachedDocuments,
        legalResults,
      });
      clearTimeout(timeout);
      return response;
    }

    const response = await fetch(privacyMode ? `${ollamaUrl}/v1/chat/completions` : "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(privacyMode ? {} : { Authorization: `Bearer ${getConfiguredApiKey("GROQ_API_KEY")}` }),
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model: activeModel,
        stream: true,
        ...(usesCloudReasoning ? { reasoning_format: "parsed" } : {}),
        ...(privacyMode && thinkingEnabled ? { think: true } : {}),
        ...(!privacyMode ? {
          tools: WEB_SEARCH_TOOLS,
          tool_choice: "auto",
        } : {}),
        ...(privacyMode ? {
          options: {
            num_ctx: documentContext ? 4096 : 2048,
          },
        } : {}),
        messages: [
          { role: "system", content: systemMessage },
          ...initialMessages,
          { role: "user", content: userContent },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok || !response.body) {
      throw new Error(`${privacyMode ? "Ollama" : "Groq"} request failed: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = "";
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
              flushSseToken(line, controller, encoder);
            }
          }
          if (buffer.trim()) {
            flushSseToken(buffer, controller, encoder);
          }
          if (shouldSearch) {
            const state = tokenFlushState.get(controller);
            const marker = formatWebSearchMarker(activeModel, webSearch.sources);
            if (state) {
              state.buffer += `\n\n${marker}`;
              tokenFlushState.set(controller, state);
            } else {
              controller.enqueue(encoder.encode(`0:${JSON.stringify(marker)}\n`));
            }
          }
          if (Array.isArray(attachedDocuments)) {
            const state = tokenFlushState.get(controller);
            const markers = attachedDocuments
              .filter((document) => document?.filename)
              .map(
                (document) =>
                  `<document-analyzed filename="${document.filename}" />`
              )
              .join("\n\n");
            if (markers && state) {
              state.buffer += `\n\n${markers}`;
              tokenFlushState.set(controller, state);
            } else if (markers) {
              controller.enqueue(
                encoder.encode(`0:${JSON.stringify(markers)}\n`)
              );
            }
          }
          {
            const legalMarker = formatLegalSourcesMarker(legalResults);
            if (legalMarker) {
              const state = tokenFlushState.get(controller);
              if (state) {
                state.buffer += `\n\n${legalMarker}`;
                tokenFlushState.set(controller, state);
              } else {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(legalMarker)}\n`));
              }
            }
          }
          const remaining = tokenFlushState.get(controller);
          if (remaining) {
            remaining.buffer += flushThinkStripState(remaining.thinkStripState);
          }
          if (remaining?.buffer) {
            controller.enqueue(
              encoder.encode(`0:${JSON.stringify(remaining.buffer)}\n`)
            );
          }
          tokenFlushState.delete(controller);
          controller.enqueue(
            encoder.encode(
              `d:${JSON.stringify({
                finishReason: "stop",
                usage: { promptTokens: 0, completionTokens: 0 },
              })}\n`
            )
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch {
    clearTimeout(timeout);
    return new Response(
      `3:${JSON.stringify(
        privacyMode
          ? "Lex is unavailable. Make sure Ollama is running and try again."
          : "Lex is unavailable. Check your internet connection and try again."
      )}\n`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
        },
      }
    );
  }
}

async function streamGeminiResponse({
  model,
  systemMessage,
  initialMessages,
  userMessage,
  shouldSearch,
  searchSources,
  activeModel,
  attachedDocuments,
  legalResults,
}: {
  model: string;
  systemMessage: string;
  initialMessages: { role: string; content: string }[];
  userMessage: string;
  shouldSearch: boolean;
  searchSources: WebSearchSource[];
  activeModel: string | null;
  attachedDocuments: { filename?: string }[] | undefined;
  legalResults: { cases: { title: string; citation: string; year: string; jurisdiction: string; court: string; summary: string; url: string; source: string }[]; databases_searched: string[]; offline: boolean };
}) {
  const apiKey = getConfiguredApiKey("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemMessage,
  });
  const contents: Content[] = [
    ...initialMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  async function attemptStream() {
    return generativeModel.generateContentStream({ contents });
  }

  let result: Awaited<ReturnType<typeof attemptStream>>;
  try {
    result = await attemptStream();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? (err as { httpStatusCode?: number })?.httpStatusCode;
    if (status === 503) {
      console.error("[Gemini 503] First attempt failed, retrying in 2s…", err);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        result = await attemptStream();
      } catch (retryErr) {
        console.error("[Gemini 503] Retry also failed:", retryErr);
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(controller) {
              const msg = "Lex Max is temporarily unavailable. Please try Lex Pro or try again in a moment.";
              flushVisibleToken(msg, controller, encoder);
              flushSseToken(null, controller, encoder);
              controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: "stop", usage: { promptTokens: 0, completionTokens: 0 } })}\n`));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Vercel-AI-Data-Stream": "v1" } }
        );
      }
    } else {
      throw err;
    }
  }

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          let reasoningContent = "";
          for await (const chunk of result.stream) {
            const { text, reasoning } = parseGeminiChunk(chunk);
            if (reasoning) reasoningContent += reasoning;
            if (text) flushVisibleToken(text, controller, encoder);
          }
          if (!reasoningContent.trim()) {
            const finalResponse = await result.response;
            reasoningContent = extractGeminiReasoning(finalResponse);
          }
          flushSseToken(null, controller, encoder);
          const markers = [
            formatThinkBlock(reasoningContent),
            shouldSearch ? formatWebSearchMarker(activeModel, searchSources) : "",
            ...(Array.isArray(attachedDocuments)
              ? attachedDocuments
                  .filter((document) => document?.filename)
                  .map(
                    (document) =>
                      `<document-analyzed filename="${document.filename}" />`
                  )
              : []),
            formatLegalSourcesMarker(legalResults),
          ].filter(Boolean).join("\n\n");
          if (markers) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(markers)}\n`));
          }
          controller.enqueue(
            encoder.encode(
              `d:${JSON.stringify({
                finishReason: "stop",
                usage: { promptTokens: 0, completionTokens: 0 },
              })}\n`
            )
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    }
  );
}

async function streamOllamaCloudResponse({
  model,
  systemMessage,
  initialMessages,
  userMessage,
  shouldSearch,
  searchSources,
  activeModel,
  attachedDocuments,
  abortSignal,
}: {
  model: string;
  systemMessage: string;
  initialMessages: { role: string; content: string }[];
  userMessage: string;
  shouldSearch: boolean;
  searchSources: WebSearchSource[];
  activeModel: string | null;
  attachedDocuments: { filename?: string }[] | undefined;
  abortSignal: AbortSignal;
}) {
  const apiKey = getConfiguredApiKey("OLLAMA_API_KEY");
  if (!apiKey) throw new Error("Missing OLLAMA_API_KEY");

  const ollamaCloud = createOllama({
    baseURL: "https://ollama.com/api",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const result = streamText({
    model: ollamaCloud.chat(model),
    system: systemMessage,
    messages: [
      ...initialMessages,
      { role: "user", content: userMessage },
    ] as CoreMessage[],
    abortSignal,
  });
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            if (part.type === "reasoning" && part.textDelta) {
              flushVisibleToken(`<think>${part.textDelta}</think>`, controller, encoder);
            }
            if (part.type === "text-delta" && part.textDelta) {
              flushVisibleToken(part.textDelta, controller, encoder);
            }
          }
          flushSseToken(null, controller, encoder);
          const markers = [
            shouldSearch ? formatWebSearchMarker(activeModel, searchSources) : "",
            ...(Array.isArray(attachedDocuments)
              ? attachedDocuments
                  .filter((document) => document?.filename)
                  .map(
                    (document) =>
                      `<document-analyzed filename="${document.filename}" />`
                  )
              : []),
          ].filter(Boolean).join("\n\n");
          if (markers) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(markers)}\n`));
          }
          controller.enqueue(
            encoder.encode(
              `d:${JSON.stringify({
                finishReason: "stop",
                usage: { promptTokens: 0, completionTokens: 0 },
              })}\n`
            )
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    }
  );
}


function sanitizeChatMessages(messages: unknown[]) {
  return messages
    .filter(isChatMessage)
    .map((message) => ({
      role: message.role,
      content: stripLeakedSystemPrompt(stripAssistantMarkup(message.content)),
    }))
    .filter((message) => message.content.length > 0);
}

function stripLeakedSystemPrompt(content: string) {
  return content
    .replace(SYSTEM_PROMPT_LEAK_REGEX, "")
    .replace(LEX_IDENTITY_LEAK_REGEX, "")
    .trim();
}

function parseGeminiChunk(chunk: unknown) {
  const reasoning = extractGeminiReasoning(chunk);
  const text = getGeminiVisibleText(chunk);
  return { text, reasoning };
}

function getGeminiVisibleText(chunk: unknown) {
  const structuredText = extractGeminiText(chunk, false);
  if (structuredText) return structuredText;
  if (isGeminiResponseWithText(chunk)) {
    try {
      return chunk.text();
    } catch {
      return "";
    }
  }
  return "";
}

function extractGeminiReasoning(response: unknown) {
  return extractGeminiText(response, true).trim();
}

function extractGeminiText(response: unknown, thought: boolean) {
  if (!isRecord(response)) return "";
  const candidates = response.candidates;
  if (!Array.isArray(candidates)) return "";

  return candidates
    .flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const content = candidate.content;
      if (!isRecord(content)) return [];
      const parts = content.parts;
      if (!Array.isArray(parts)) return [];
      return parts
        .filter((part) => isRecord(part) && typeof part.text === "string")
        .filter((part) => Boolean(part.thought) === thought)
        .map((part) => String(part.text));
    })
    .join("");
}

function formatThinkBlock(content: string) {
  const trimmed = content.trim();
  return trimmed ? `<think>${trimmed}</think>` : "";
}

function isGeminiResponseWithText(
  value: unknown
): value is { text: () => string } {
  return isRecord(value) && typeof value.text === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function flushSseToken(
  line: string | null,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  if (line === null) {
    const remaining = tokenFlushState.get(controller);
    if (remaining) {
      remaining.buffer += flushThinkStripState(remaining.thinkStripState);
    }
    if (remaining?.buffer) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(remaining.buffer)}\n`));
    }
    tokenFlushState.delete(controller);
    return;
  }

  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return;

  try {
    const parsed = JSON.parse(payload);
    const delta = parsed.choices?.[0]?.delta;
    const thinkingToken =
      delta?.reasoning || delta?.reasoning_content || delta?.thinking;
    const token = delta?.content;
    if (thinkingToken) {
      flushVisibleToken(`<think>${thinkingToken}</think>`, controller, encoder);
    }
    if (token) {
      flushVisibleToken(token, controller, encoder);
    }
  } catch {
    return;
  }
}

function flushVisibleToken(
  token: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  const state = tokenFlushState.get(controller) || {
    buffer: "",
    lastFlush: Date.now(),
    thinkStripState: createThinkStripState(),
    preambleDone: false,
    preambleAccum: "",
  };
  const visibleToken = token ? stripToken(stripAssistantStreamChunk(token, state.thinkStripState)) : "";
  if (state.thinkStripState.strippedContent) {
    controller.enqueue(encoder.encode(`0:${JSON.stringify("")}\n`));
    state.thinkStripState.strippedContent = false;
  }

  // --- Server-side search-process preamble stripping ---
  if (!state.preambleDone) {
    state.preambleAccum += visibleToken;
    const stripped = stripSearchPreambleAccum(state.preambleAccum);
    if (stripped !== null) {
      // Found real content boundary — emit whatever survives the strip
      state.preambleDone = true;
      state.preambleAccum = "";
      if (stripped.length > 0) {
        state.buffer += stripped;
      }
    }
    // Haven't found boundary yet — keep accumulating (emit nothing)
    tokenFlushState.set(controller, state);
    if (state.preambleDone && state.buffer.length > 0) {
      const now = Date.now();
      if (state.buffer.length >= 3 || now - state.lastFlush > 50) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(state.buffer)}\n`));
        state.buffer = "";
        state.lastFlush = now;
      }
    }
    return;
  }
  // --- End preamble stripping ---

  state.buffer += visibleToken;
  const now = Date.now();
  if (state.buffer.length >= 3 || now - state.lastFlush > 50) {
    controller.enqueue(encoder.encode(`0:${JSON.stringify(state.buffer)}\n`));
    state.buffer = "";
    state.lastFlush = now;
  }
  tokenFlushState.set(controller, state);
}

// Per-token strip patterns for search-process noise that appears inline.
const STRIP_PATTERNS: RegExp[] = [
  /Will perform web search[^\n]*/gi,
  /Search query:[^\n]*/gi,
  /Search results[^\n]*/gi,
  /Fetching[^\n]*/gi,
  /I'll simulate[^\n]*/gi,
  /\.search[^\n]*/gi,
];

function stripToken(text: string): string {
  let clean = text;
  for (const pattern of STRIP_PATTERNS) {
    clean = clean.replace(pattern, "");
  }
  // Strip raw <function...>...</function> tags that leak from tool calls
  clean = clean.replace(/<function[^>]*>[\s\S]*?<\/function>/gi, "");
  clean = clean.replace(/<function[^>]*\/>/gi, "");
  // Strip any line starting with <function
  clean = clean.replace(/^<function[^\n]*$/gm, "");
  return clean;
}

// Accumulation-based pattern for multi-token preamble stripping.
// Used by stripSearchPreambleAccum below.
const SERVER_SEARCH_PREAMBLE_RE = /^[\s\S]*?(?:will perform web search|search(?:ing)?(?: web| query| results)?\.{0,3}|search\s*:|search query\s*:|\.search|i['']ll simulate(?:\s+search(?:ing)?)?)[^\n]*\n?/i;

function stripSearchPreambleAccum(accum: string): string | null {
  // If we have a paragraph break or ≥120 chars, make a decision
  const hasParagraphBreak = /\n\n/.test(accum);
  const longEnough = accum.length >= 120;

  if (!hasParagraphBreak && !longEnough) {
    // Still too short — keep accumulating unless it already looks clean
    const trimmed = accum.trimStart().toLowerCase();
    const looksClean =
      !trimmed.startsWith("search") &&
      !trimmed.startsWith("will perform") &&
      !trimmed.startsWith("i'll simulate") &&
      !trimmed.startsWith("i\u2019ll simulate") &&
      !trimmed.startsWith(".search") &&
      !trimmed.startsWith("searching");
    if (looksClean && accum.length >= 4) {
      // Starts with real content — emit immediately
      return accum;
    }
    return null; // keep accumulating
  }

  // Strip the search preamble then return whatever remains
  const afterStrip = accum.replace(SERVER_SEARCH_PREAMBLE_RE, "").trimStart();
  return afterStrip;
}

function isChatMessage(
  message: unknown
): message is { role: string; content: string } {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as { role?: unknown; content?: unknown };
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function shouldUseWebSearch(message: string) {
  const normalized = message.toLowerCase();
  if (
    NO_SEARCH_TRIGGERS.some((trigger) => normalized.includes(trigger)) &&
    !SEARCH_TRIGGERS.some((trigger) => normalized.includes(trigger))
  ) {
    return false;
  }

  return SEARCH_TRIGGERS.some((trigger) => normalized.includes(trigger));
}

const tokenFlushState: WeakMap<
  ReadableStreamDefaultController<Uint8Array>,
  {
    buffer: string;
    lastFlush: number;
    thinkStripState: ReturnType<typeof createThinkStripState>;
    preambleDone: boolean;
    preambleAccum: string;
  }
> = new WeakMap();

async function getWebSearchContext(query: string): Promise<{ context: string; sources: WebSearchSource[] }> {
  const apiKey = getConfiguredApiKey("SERPER_API_KEY");

  if (!apiKey?.trim()) {
    return {
      context: "\n\nWeb search is unavailable because SERPER_API_KEY is not configured.",
      sources: [],
    };
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey.trim(),
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      return { context: "\n\nWeb search is unavailable right now.", sources: [] };
    }

    const data = await response.json();
    const results = Array.isArray(data?.organic) ? data.organic.slice(0, 5) : [];

    if (results.length === 0) return { context: "", sources: [] };

    const sources = results
      .map((result: { title?: string; link?: string }) => {
        if (!result.link) return null;
        try {
          const domain = new URL(result.link).hostname.replace(/^www\./, "");
          return {
            title: result.title || domain,
            url: result.link,
            domain,
          };
        } catch {
          return null;
        }
      })
      .filter((source: WebSearchSource | null): source is WebSearchSource => Boolean(source));

    return {
      context: `\n\nWeb search results for '${query}':\n${results
        .map(
          (result: { title?: string; snippet?: string; link?: string }, index: number) =>
            `${index + 1}. ${result.title || "Untitled"}\n${result.snippet || ""}\n${result.link || ""}`
        )
        .join("\n\n")}\n\nUse these results to inform your response if relevant.`,
      sources,
    };
  } catch {
    return { context: "\n\nWeb search is unavailable right now.", sources: [] };
  }
}

function formatWebSearchMarker(model: string | null, sources: WebSearchSource[]) {
  const sourceAttribute = sources.length > 0
    ? ` sources="${encodeURIComponent(JSON.stringify(sources))}"`
    : "";
  return `<web-search-used model="${model || ""}"${sourceAttribute} />`;
}

function formatLegalSourcesMarker(results: { cases: { title: string; citation: string; year: string; jurisdiction: string; court: string; summary: string; url: string; source: string }[]; databases_searched: string[]; offline: boolean }) {
  if (results.cases.length === 0 && !results.offline) return "";
  return `<legal-sources data="${encodeURIComponent(JSON.stringify(results))}" />`;
}
