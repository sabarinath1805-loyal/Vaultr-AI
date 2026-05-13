import { createOllama } from 'ollama-ai-provider';
import { streamText, convertToCoreMessages, UserContent } from 'ai';
import { LEX_SYSTEM_PROMPT, OLLAMA_DEFAULT_URL } from '@/lib/lex';

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Destructure request data
  const { messages, selectedModel, data } = await req.json();

  const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;

  const initialMessages = messages.slice(0, -1).slice(-10);
  const currentMessage = messages[messages.length - 1]; 

  const ollama = createOllama({baseURL: ollamaUrl + "/api"});

  // Build message content array directly
  const messageContent: UserContent = [{ type: 'text', text: currentMessage.content }];

  // Add images if they exist
  data?.images?.forEach((imageUrl: string) => {
    const image = new URL(imageUrl);
    messageContent.push({ type: 'image', image });
  });

  // Stream text using the ollama model
  const result = await streamText({
    model: ollama(selectedModel),
    messages: [
      { role: 'system', content: LEX_SYSTEM_PROMPT },
      ...convertToCoreMessages(initialMessages),
      { role: 'user', content: messageContent },
    ],
  });

  return result.toDataStreamResponse();
}
