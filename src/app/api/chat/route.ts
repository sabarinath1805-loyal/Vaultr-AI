import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { isLexModel } from "@/lib/models";
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
    serperApiKey,
    thinking,
    ollamaUrl: requestedOllamaUrl,
  } = await req.json();
  if (!isLexModel(selectedModel)) {
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
  const initialMessages = messages.slice(0, -1).slice(-10);
  const currentMessage = messages[messages.length - 1];
  const searchContext = webSearch
    ? await getWebSearchContext(currentMessage.content, serperApiKey)
    : "";
  const workflowContext = workflow?.prompt
    ? `\n\nWorkflow context (${workflow.title}):\n${workflow.prompt}`
    : "";
  const documentContexts = Array.isArray(attachedDocuments)
    ? await Promise.all(
        attachedDocuments.map(
          async (document: {
            filename: string;
            fileType?: string | null;
            content?: string;
            dataUrl?: string;
          }) => {
            const extractedText = await extractDocumentText(document);
            if (!extractedText) return "";
            return `\n\nThe user has attached a document titled '${document.filename}'. Full content:\n\n${extractedText}\n\nAnswer the user's question based on this document.`;
          }
        )
      )
    : [];
  const documentContext = documentContexts.filter(Boolean).join("");
  const systemContent = `${LEX_SYSTEM_PROMPT}${documentContext}${workflowContext}${searchContext}`;
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
    const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        model: selectedModel,
        stream: true,
        ...(thinking ? { think: true } : {}),
        messages: [
          { role: "system", content: systemContent },
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
      throw new Error(`Ollama request failed: ${response.status}`);
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
              enqueueSseLine(line, controller, encoder);
            }
          }
          if (buffer.trim()) {
            enqueueSseLine(buffer, controller, encoder);
          }
          if (webSearch) {
            controller.enqueue(
              encoder.encode(`0:${JSON.stringify(`\n\n<web-search-used model="${selectedModel}" />`)}\n`)
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
        "Lex is unavailable. Make sure Ollama is running and try again."
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

function enqueueSseLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
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
      controller.enqueue(encoder.encode(`0:${JSON.stringify(token)}\n`));
    }
  } catch {
    return;
  }
}

async function getWebSearchContext(query: string, apiKey?: string) {
  if (!apiKey?.trim()) {
    return "\n\nAdd a Serper API key in Settings to use web search.";
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
      return "\n\nAdd a Serper API key in Settings to use web search.";
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
    return "\n\nAdd a Serper API key in Settings to use web search.";
  }
}
