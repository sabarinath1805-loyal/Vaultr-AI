import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ query: "" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ query: message });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "system",
            content:
              "Extract 3-5 key legal search terms from this query. Return ONLY the search terms as a short phrase, nothing else. Focus on legal concepts, jurisdiction, and cause of action.",
          },
          { role: "user", content: message },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({ query: message });
    }

    const data = await response.json();
    const extracted = data.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ query: extracted || message });
  } catch {
    return NextResponse.json({ query: "" });
  }
}
