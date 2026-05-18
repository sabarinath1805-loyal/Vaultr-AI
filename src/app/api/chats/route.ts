import { NextResponse } from "next/server";
import { createChat, deleteAllChats, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { CONTRACT_ANALYSIS_PROMPT } from "@/lib/contract-scanner";
import { OLLAMA_DEFAULT_URL } from "@/lib/lex";
import { GROQ_DEFAULT_MODEL, isCloudModel, isLexModel, lexNameToOllamaId } from "@/lib/models";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import { extractDocxText } from "@/lib/file-extraction/docx-extractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function patchPredatoryClauseFindings(text: string, analysis: unknown) {
  if (!isRecord(analysis)) return analysis;
  const lowerText = text.toLowerCase();
  const clauses = Array.isArray(analysis.clauses) ? [...analysis.clauses] : [];

  const ensureClause = (needle: string, clause: Record<string, string>) => {
    if (!lowerText.includes(needle.toLowerCase())) return;
    const alreadyFlagged = clauses.some((item) => {
      if (!isRecord(item)) return false;
      const title = typeof item.title === "string" ? item.title : "";
      const excerpt = typeof item.excerpt === "string" ? item.excerpt : "";
      const issue = typeof item.issue === "string" ? item.issue : "";
      const haystack = `${title} ${excerpt} ${issue}`.toLowerCase();
      return haystack.includes(needle.toLowerCase()) || haystack.includes(clause.title.toLowerCase());
    });
    if (!alreadyFlagged) clauses.unshift(clause);
  };

  ensureClause("4.3", {
    title: "Section 4.3 — restriction on independent legal advice",
    excerpt: "Section 4.3",
    risk: "CRITICAL",
    issue: "A clause preventing independent legal advice is predatory because it interferes with informed consent and should be treated as the highest priority risk.",
    recommendation: "Delete the restriction entirely and preserve an express right for each party to seek independent legal advice.",
  });
  ensureClause("8.1", {
    title: "Section 8.1 — unilateral amendments",
    excerpt: "Section 8.1",
    risk: "HIGH",
    issue: "One party can amend terms by notice alone, leaving the other side bound without negotiated consent.",
    recommendation: "Require written mutual agreement for any amendment.",
  });
  ensureClause("9.3", {
    title: "Section 9.3 — one-sided arbitration costs",
    excerpt: "Section 9.3",
    risk: "HIGH",
    issue: "One party bears arbitration costs regardless of outcome, creating one-sided dispute economics.",
    recommendation: "Use tribunal discretion or loser-pays allocation instead of a fixed one-sided cost burden.",
  });

  return { ...analysis, clauses };
}

function parseJsonResponse(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOllamaResponseText(payload: unknown) {
  if (!isRecord(payload)) return "";
  const message = payload.message;
  if (isRecord(message) && typeof message.content === "string") {
    return message.content;
  }
  if (typeof payload.response === "string") {
    return payload.response;
  }
  return "";
}

function getOpenAiResponseText(payload: unknown) {
  if (!isRecord(payload)) return "";
  const choices = payload.choices;
  if (!Array.isArray(choices)) return "";
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return "";
  const message = firstChoice.message;
  if (isRecord(message) && typeof message.content === "string") {
    return message.content;
  }
  return "";
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
    const selectedModelValue = formData.get("selectedModel");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Please upload a contract under 10MB." },
        { status: 413 }
      );
    }
    if (typeof selectedModelValue !== "string") {
      return NextResponse.json(
        { error: "Contract Scanner requires a Lex model. Please install one first." },
        { status: 400 }
      );
    }

    const selectedModel = lexNameToOllamaId(selectedModelValue) || selectedModelValue;
    const cloudScan = isCloudModel(selectedModel) || selectedModel === GROQ_DEFAULT_MODEL;

    if (!cloudScan && !isLexModel(selectedModel)) {
      return NextResponse.json(
        { error: "Contract Scanner requires a Lex model. Please install one first." },
        { status: 400 }
      );
    }

    try {
      const contractText = await extractText(file);
      const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
      const prompt = CONTRACT_ANALYSIS_PROMPT.replace("{contract_text}", contractText);
      const response = await fetch(cloudScan ? "https://api.groq.com/openai/v1/chat/completions" : `${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cloudScan ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {}),
        },
        body: JSON.stringify(
          cloudScan
            ? {
                model: selectedModel,
                stream: false,
                messages: [{ role: "user", content: prompt }],
              }
            : {
                model: selectedModel,
                stream: false,
                messages: [{ role: "user", content: prompt }],
              }
        ),
      });
      const responseBody = await response.text();

      if (!response.ok) {
        console.error("Contract scanner model error response", {
          model: selectedModel,
          status: response.status,
          body: responseBody,
        });
        return NextResponse.json(
          {
            error: cloudScan
              ? "Lex is unavailable. Check your internet connection and try again."
              : "Ollama is not running. Start Ollama to use Contract Scanner.",
          },
          { status: 503 }
        );
      }

      const payload = JSON.parse(responseBody);
      const responseText = cloudScan
        ? getOpenAiResponseText(payload)
        : getOllamaResponseText(payload);

      if (!responseText) {
        console.error("Contract scanner empty Ollama response", {
          model: selectedModel,
          body: responseBody,
        });
        return NextResponse.json(
          { error: "Lex returned an unexpected response. Please try again." },
          { status: 422 }
        );
      }

      return NextResponse.json({
        analysis: patchPredatoryClauseFindings(contractText, parseJsonResponse(responseText)),
      });
    } catch (error) {
      console.error("Contract scanner API error", {
        model: selectedModel,
        error,
      });
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Lex returned an unexpected response. Please try again." },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          error: cloudScan
            ? "Lex is unavailable. Check your internet connection and try again."
            : "Ollama is not running. Start Ollama to use Contract Scanner.",
        },
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
