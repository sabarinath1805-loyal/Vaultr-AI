import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createOllama } from "ollama-ai-provider";
import { streamText, type CoreMessage } from "ai";
import {
  GROQ_DEFAULT_MODEL,
  isCloudModel,
  isGeminiModel,
  isLexModel,
  isOllamaCloudModel,
} from "@/lib/models";
import { extractDocumentText } from "@/lib/document-extraction";

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

const GEMINI_MODELS = ["gemini-3-flash-preview"];

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
  const ollamaCloudModel = !privacyMode && isOllamaCloudModel(activeModel)
    ? activeModel
    : null;
  const conversationMessages = Array.isArray(messages) ? messages : [];
  const initialMessages = conversationMessages.slice(0, -1).filter(isChatMessage);
  const currentMessage = conversationMessages[conversationMessages.length - 1];
  const userMessage =
    typeof currentMessage?.content === "string" ? currentMessage.content : "";
  const shouldSearch = !privacyMode && shouldUseWebSearch(userMessage);
  const searchContext = shouldSearch
    ? await getWebSearchContext(userMessage)
    : "";
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
            const extractedText = await extractDocumentText(document);
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
  const systemMessage = `${finalSystemPrompt}${documentContext}${searchContext}`;
  console.log("SYSTEM PROMPT APPLIED:", systemMessage.substring(0, 1200));
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
        activeModel,
        attachedDocuments,
      });
      clearTimeout(timeout);
      return response;
    }

    if (ollamaCloudModel) {
      const response = await streamOllamaCloudResponse({
        model: ollamaCloudModel,
        systemMessage,
        initialMessages,
        userMessage,
        shouldSearch,
        activeModel,
        attachedDocuments,
        abortSignal: abortController.signal,
      });
      clearTimeout(timeout);
      return response;
    }

    const response = await fetch(privacyMode ? `${ollamaUrl}/v1/chat/completions` : "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(privacyMode ? {} : { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }),
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model: activeModel,
        stream: true,
        ...(usesCloudReasoning ? { reasoning_format: "parsed" } : {}),
        ...(privacyMode && thinkingEnabled ? { think: true } : {}),
        ...(privacyMode ? {
          options: {
            num_ctx: documentContext ? 4096 : 2048,
          },
        } : {}),
        messages: [
          { role: "system", content: systemMessage },
          ...initialMessages.map(
            (message: { role: string; content: string }) => ({
              role: message.role,
              content: message.content,
            })
          ),
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
            const marker = `<web-search-used model="${activeModel}" />`;
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
          const remaining = tokenFlushState.get(controller);
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
  activeModel,
  attachedDocuments,
}: {
  model: string;
  systemMessage: string;
  initialMessages: { role: string; content: string }[];
  userMessage: string;
  shouldSearch: boolean;
  activeModel: string | null;
  attachedDocuments: { filename?: string }[] | undefined;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemMessage,
  });
  const contents: Content[] = [
    ...initialMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const result = await generativeModel.generateContentStream({ contents });
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          let reasoningContent = "";
          for await (const chunk of result.stream) {
            const { text, reasoning } = parseGeminiChunk(chunk);
            if (reasoning) reasoningContent += reasoning;
            if (text) controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }
          if (!reasoningContent.trim()) {
            const finalResponse = await result.response;
            reasoningContent = extractGeminiReasoning(finalResponse);
          }
          const markers = [
            formatThinkBlock(reasoningContent),
            shouldSearch ? `<web-search-used model="${activeModel}" />` : "",
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

async function streamOllamaCloudResponse({
  model,
  systemMessage,
  initialMessages,
  userMessage,
  shouldSearch,
  activeModel,
  attachedDocuments,
  abortSignal,
}: {
  model: string;
  systemMessage: string;
  initialMessages: { role: string; content: string }[];
  userMessage: string;
  shouldSearch: boolean;
  activeModel: string | null;
  attachedDocuments: { filename?: string }[] | undefined;
  abortSignal: AbortSignal;
}) {
  const apiKey = process.env.OLLAMA_API_KEY;
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
      ...initialMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
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
              controller.enqueue(
                encoder.encode(`0:${JSON.stringify(`<think>${part.textDelta}</think>`)}\n`)
              );
            }
            if (part.type === "text-delta" && part.textDelta) {
              controller.enqueue(encoder.encode(`0:${JSON.stringify(part.textDelta)}\n`));
            }
          }
          const markers = [
            shouldSearch ? `<web-search-used model="${activeModel}" />` : "",
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

function parseGeminiChunk(chunk: unknown) {
  const reasoning = extractGeminiReasoning(chunk);
  const text = getGeminiVisibleText(chunk);
  return { text, reasoning };
}

function getGeminiVisibleText(chunk: unknown) {
  const structuredText = extractGeminiText(chunk, false);
  if (structuredText) return structuredText;
  if (isGeminiResponseWithText(chunk)) return chunk.text();
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
      controller.enqueue(
        encoder.encode(`0:${JSON.stringify(`<think>${thinkingToken}</think>`)}\n`)
      );
    }
    if (token) {
      const state = tokenFlushState.get(controller) || {
        buffer: "",
        lastFlush: Date.now(),
      };
      state.buffer += token;
      const now = Date.now();
      if (state.buffer.length >= 3 || now - state.lastFlush > 50) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(state.buffer)}\n`));
        state.buffer = "";
        state.lastFlush = now;
      }
      tokenFlushState.set(controller, state);
    }
  } catch {
    return;
  }
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
  { buffer: string; lastFlush: number }
> = new WeakMap();

async function getWebSearchContext(query: string) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey?.trim()) {
    return "\n\nWeb search is unavailable because SERPER_API_KEY is not configured.";
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
      return "\n\nWeb search is unavailable right now.";
    }

    const data = await response.json();
    const results = Array.isArray(data?.organic) ? data.organic.slice(0, 5) : [];

    if (results.length === 0) return "";

    return `\n\nWeb search results for '${query}':\n${results
      .map(
        (result: { title?: string; snippet?: string; link?: string }, index: number) =>
          `${index + 1}. ${result.title || "Untitled"}\n${result.snippet || ""}\n${result.link || ""}`
      )
      .join("\n\n")}\n\nUse these results to inform your response if relevant.`;
  } catch {
    return "\n\nWeb search is unavailable right now.";
  }
}
