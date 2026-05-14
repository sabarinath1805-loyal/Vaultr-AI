import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from '@/lib/lex';

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages, selectedModel, data } = await req.json();
  const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  const initialMessages = messages.slice(0, -1).slice(-10);
  const currentMessage = messages[messages.length - 1];
  const userContent = data?.images?.length
    ? [
        { type: 'text', text: currentMessage.content },
        ...data.images.map((imageUrl: string) => ({
          type: 'image_url',
          image_url: { url: imageUrl },
        })),
      ]
    : currentMessage.content;

  try {
    const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        stream: true,
        messages: [
          { role: 'system', content: LEX_SYSTEM_PROMPT },
          ...initialMessages.map((message: { role: string; content: string }) => ({
            role: message.role,
            content: message.content,
          })),
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = '';
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) controller.enqueue(encoder.encode(`0:${JSON.stringify(token)}\n`));
              } catch {
                continue;
              }
            }
          }
          controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0 } })}\n`));
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
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch {
    return new Response(
      `3:${JSON.stringify('Ollama is not running. Start Ollama to chat with Lex.')}\n`,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1',
        },
      }
    );
  }
}
