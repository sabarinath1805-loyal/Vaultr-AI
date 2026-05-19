import { NextResponse } from "next/server";
import { extractDocxText } from "@/lib/file-extraction/docx-extractor";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import {
  CONTRACT_ANALYSIS_PROMPT,
  parseContractAnalysisJson,
  patchPredatoryClauseFindings,
} from "@/lib/contract-scanner";
import { LEX_SYSTEM_PROMPT } from "@/lib/lex";
import { GROQ_DEFAULT_MODEL } from "@/lib/models";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function scanContractFormData(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Please upload a contract under 10MB." },
      { status: 413 }
    );
  }

  try {
    const contractText = await extractText(file);
    const prompt = CONTRACT_ANALYSIS_PROMPT.replace("{contract_text}", contractText);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_DEFAULT_MODEL,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: LEX_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    const responseBody = await response.text();

    if (!response.ok) {
      console.error("Contract scanner Groq error response", {
        model: GROQ_DEFAULT_MODEL,
        status: response.status,
        body: responseBody,
      });
      return NextResponse.json(
        { error: "Lex is unavailable. Check your internet connection and try again." },
        { status: 503 }
      );
    }

    const payload = JSON.parse(responseBody);
    const responseText = getOpenAiResponseText(payload);

    if (!responseText) {
      console.error("Contract scanner empty Groq response", {
        model: GROQ_DEFAULT_MODEL,
        body: responseBody,
      });
      return NextResponse.json(
        { error: "Lex returned an unexpected response. Please try again." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      analysis: patchPredatoryClauseFindings(
        contractText,
        parseContractAnalysisJson(responseText)
      ),
    });
  } catch (error) {
    console.error("Contract scanner API error", {
      model: GROQ_DEFAULT_MODEL,
      error,
    });
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Lex returned an unexpected response. Please try again." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Lex is unavailable. Check your internet connection and try again." },
      { status: 503 }
    );
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
