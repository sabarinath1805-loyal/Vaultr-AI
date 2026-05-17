import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { GROQ_DEFAULT_MODEL, isLexModel, isGroqModel } from "@/lib/models";
import { extractDocumentText } from "@/lib/document-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const {
    messages,
    selectedModel,
    data,
    workflow,
    attachedDocuments,
    webSearch,
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
  const groqModel = isGroqModel(requestedModel)
    ? requestedModel
    : process.env.GROQ_DEFAULT_MODEL || GROQ_DEFAULT_MODEL;
  const activeModel = privacyMode ? requestedModel : groqModel;
  const initialMessages = messages.slice(0, -1).slice(-10);
  const currentMessage = messages[messages.length - 1];
  const searchContext = webSearch
    ? await getWebSearchContext(currentMessage.content)
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
  const systemPrompt = LEX_SYSTEM_PROMPT + (thinkingEnabled ? "" : "\n\n/no_think");
  const finalSystemPrompt = workflowTemplatePrompt
    ? `${workflowTemplatePrompt}\n\n${systemPrompt}`
    : systemPrompt;
  const systemMessage = `${finalSystemPrompt}${documentContext}${searchContext}`;
  console.log("SYSTEM PROMPT APPLIED:", systemPrompt.substring(0, 100));
  const userContent = data?.images?.length
    ? [
        { type: "text", text: currentMessage.content },
        ...data.images.map((imageUrl: string) => ({
          type: "image_url",
          image_url: { url: imageUrl },
        })),
      ]
    : currentMessage.content;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 120_000);

  try {
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
          flushSseToken(null, controller, encoder);
          if (webSearch) {
            controller.enqueue(
              encoder.encode(`0:${JSON.stringify(`\n\n<web-search-used model="${activeModel}" />`)}\n`)
            );
          }
          if (Array.isArray(attachedDocuments)) {
            for (const document of attachedDocuments) {
              if (document?.filename) {
                controller.enqueue(
                  encoder.encode(
                    `0:${JSON.stringify(`\n\n<document-analyzed filename="${document.filename}" />`)}\n`
                  )
                );
              }
            }
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
    const thinkingToken = delta?.thinking;
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
