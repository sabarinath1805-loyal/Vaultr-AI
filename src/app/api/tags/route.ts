import { OLLAMA_DEFAULT_URL } from "@/lib/lex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  const res = await fetch(`${ollamaUrl}/api/tags`);
  return new Response(res.body, res);
}
