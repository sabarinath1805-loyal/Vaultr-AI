import { OLLAMA_DEFAULT_URL } from "@/lib/lex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OLLAMA_TIMEOUT_MS = 3000;

export async function GET() {
  const candidates = Array.from(
    new Set([process.env.OLLAMA_URL, OLLAMA_DEFAULT_URL].filter(Boolean))
  ) as string[];

  for (const ollamaUrl of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      const res = await fetch(`${ollamaUrl}/api/tags`, {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return new Response(res.body, res);
    } catch {
      continue;
    }
  }

  return Response.json({ error: "Ollama is not running", models: [] }, { status: 503 });
}
