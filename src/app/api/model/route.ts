import { OLLAMA_DEFAULT_URL } from "@/lib/lex";

// app/api/model/route.ts
export async function POST(req: Request) {
  const { name } = await req.json();

  const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;

  let response: Response;
  try {
    response = await fetch(ollamaUrl + "/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name, name, stream: true }),
    });
  } catch {
    return Response.json({ error: "Start Ollama first" }, { status: 503 });
  }

  if (!response.ok) {
    return Response.json({ error: "Start Ollama first" }, { status: response.status });
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/x-ndjson");
  return new Response(response.body, { headers });
}