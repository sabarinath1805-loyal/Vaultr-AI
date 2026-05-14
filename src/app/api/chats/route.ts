import { NextResponse } from "next/server";
import { createOllama } from "ollama-ai-provider";
import { generateText } from "ai";
import { createChat, deleteAllChats, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { CONTRACT_ANALYSIS_PROMPT } from "@/lib/contract-scanner";
import { OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { isLexModel } from "@/lib/models";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import { extractDocxText } from "@/lib/file-extraction/docx-extractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function parseJsonResponse(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (name.endsWith(".docx")) {
    return extractDocxText(buffer);
  }

  return buffer.toString("utf8");
}

export async function GET() {
  const chats = listChatsWithMessages().reduce<Record<string, ReturnType<typeof toClientChat>>>(
    (acc, chat) => {
      acc[chat.id] = toClientChat(chat);
      return acc;
    },
    {}
  );

  return NextResponse.json({ chats });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    const selectedModel = formData.get("selectedModel");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Please upload a contract under 10MB." },
        { status: 413 }
      );
    }
    if (typeof selectedModel !== "string" || !isLexModel(selectedModel)) {
      return NextResponse.json(
        { error: "Contract Scanner requires a Lex model. Please install one first." },
        { status: 400 }
      );
    }

    try {
      const contractText = await extractText(file);
      const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
      const ollama = createOllama({ baseURL: `${ollamaUrl}/api` });
      const prompt = CONTRACT_ANALYSIS_PROMPT.replace("{contract_text}", contractText);

      const result = await generateText({
        model: ollama(selectedModel),
        messages: [{ role: "user", content: prompt }],
      });

      return NextResponse.json({ analysis: parseJsonResponse(result.text) });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Lex returned an unexpected response. Please try again." },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { error: "Ollama is not running. Start Ollama to use Contract Scanner." },
        { status: 503 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const chat = createChat(body.id);

  return NextResponse.json({ chat: toClientChat({ ...chat, messages: [] }) });
}

export async function DELETE() {
  deleteAllChats();

  return NextResponse.json({ ok: true });
}
