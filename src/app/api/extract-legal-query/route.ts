import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { isSupabaseConfigured, getSessionUser } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Auth gate — require authenticated user when Supabase is configured
    if (isSupabaseConfigured()) {
      const authHeader = request.headers.get("authorization");
      // TODO: remove dev bypass before beta launch
      if (process.env.NODE_ENV === "development" && !authHeader) {
        // Allow dev bypass
      } else {
        const user = await getSessionUser(authHeader);
        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }

    const body = await request.json().catch(() => ({}));
    const message = body?.message;
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Valid message string is required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ query: message });
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
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
