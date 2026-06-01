import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

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

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content:
            "Extract 3-5 key legal search terms from the user query. Return ONLY the search terms as a short phrase (under 10 words). Focus on legal concepts, cause of action, jurisdiction, and legal doctrine. No explanation, no punctuation, just the search terms.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 30,
      temperature: 0,
    });

    const query = completion.choices[0]?.message?.content?.trim() || message;
    return NextResponse.json({ query });
  } catch {
    return NextResponse.json({ query: "" });
  }
}
