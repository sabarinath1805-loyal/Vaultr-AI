import { NextResponse } from "next/server";
import { extractDocxText } from "@/lib/file-extraction/docx-extractor";
import { extractPdfText } from "@/lib/file-extraction/pdf-extractor";
import {
  CONTRACT_ANALYSIS_PROMPT,
  parseContractAnalysisJson,
  patchPredatoryClauseFindings,
} from "@/lib/contract-scanner";
import { LEX_SYSTEM_PROMPT } from "@/lib/lex";
import { ANTHROPIC_CORE_MODEL, GROQ_DEFAULT_MODEL } from "@/lib/models";
import { getConfiguredApiKey } from "@/lib/tauri-env";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const OLLAMA_HEALTH_URL = "http://localhost:11434";
const PRIVATE_CONTRACT_SCANNER_MODEL = "qwen3:8b";
const JSON_RETRY_PROMPT_SUFFIX = `

Your first response was not valid JSON.
Return JSON only.
Do not use markdown fences.
Do not include commentary.
Every key and string value must use double quotes.
Do not emit control characters.`;

export async function scanContractFormData(formData: FormData) {
  const file = formData.get("file");
  const mode = formData.get("mode") === "private" ? "private" : "cloud";
  const requestedOllamaUrl = formData.get("ollamaUrl");
  const ollamaUrl =
    typeof requestedOllamaUrl === "string" && requestedOllamaUrl.trim()
      ? requestedOllamaUrl.trim()
      : process.env.OLLAMA_URL || OLLAMA_HEALTH_URL;

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
    if (mode === "private") {
      try {
        const health = await fetch(`${OLLAMA_HEALTH_URL}/api/tags`, { cache: "no-store" });
        if (health.status !== 200) {
          return NextResponse.json({ error: "Start Ollama first" }, { status: 503 });
        }
      } catch {
        return NextResponse.json({ error: "Start Ollama first" }, { status: 503 });
      }
    }

    const prompt = CONTRACT_ANALYSIS_PROMPT.replace("{contract_text}", contractText);
    const modelId = mode === "private" ? PRIVATE_CONTRACT_SCANNER_MODEL : ANTHROPIC_CORE_MODEL;
    let responseBody: string;
    try {
      responseBody = await requestContractAnalysis({
        mode,
        model: modelId,
        ollamaUrl,
        prompt,
      });
    } catch (primaryErr) {
      if (mode === "cloud") {
        console.warn(`[Contract Scanner] Claude failed, falling back to Groq`, primaryErr);
        responseBody = await requestContractAnalysis({
          mode,
          model: GROQ_DEFAULT_MODEL,
          ollamaUrl,
          prompt,
        });
      } else {
        throw primaryErr;
      }
    }

    const payload = JSON.parse(responseBody);
    const responseText = getOpenAiResponseText(payload);

    if (!responseText) {
      console.error("Contract scanner empty model response", {
        mode,
        model: modelId,
        body: responseBody,
      });
      return NextResponse.json(
        { error: "Lex returned an unexpected response. Please try again." },
        { status: 422 }
      );
    }

    let analysis;
    try {
      analysis = parseContractAnalysisJson(responseText);
    } catch (error) {
      console.warn("Contract scanner JSON parse failed, retrying with stricter prompt", {
        mode,
        model: modelId,
        error,
      });

      const retryBody = await requestContractAnalysis({
        mode,
        model: modelId,
        ollamaUrl,
        prompt: `${prompt}${JSON_RETRY_PROMPT_SUFFIX}`,
      });
      const retryPayload = JSON.parse(retryBody);
      const retryText = getOpenAiResponseText(retryPayload);

      if (!retryText) {
        throw error;
      }

      analysis = parseContractAnalysisJson(retryText);
    }

    return NextResponse.json({
      analysis: patchPredatoryClauseFindings(contractText, analysis),
    });
  } catch (error) {
    console.error("Contract scanner API error", {
      mode,
      model: mode === "private" ? PRIVATE_CONTRACT_SCANNER_MODEL : GROQ_DEFAULT_MODEL,
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
        error:
          mode === "private"
            ? "Lex is unavailable. Make sure Ollama is running and try again."
            : "Lex is unavailable. Check your internet connection and try again.",
      },
      { status: 503 }
    );
  }
}

async function requestContractAnalysis({
  mode,
  model,
  ollamaUrl,
  prompt,
}: {
  mode: "private" | "cloud";
  model: string;
  ollamaUrl: string;
  prompt: string;
}) {
  const isAnthropic = mode === "cloud" && model === ANTHROPIC_CORE_MODEL;
  const anthropicBaseUrl = (process.env.ANTHROPIC_BASE_URL?.trim()?.replace(/\/$/, "") || "https://api.claudeopus.pro");
  const cloudUrl = isAnthropic
    ? `${anthropicBaseUrl}/v1/chat/completions`
    : "https://api.groq.com/openai/v1/chat/completions";
  const cloudKey = isAnthropic
    ? getConfiguredApiKey("CLAUDEOPUS_API_KEY")
    : getConfiguredApiKey("GROQ_API_KEY");
  const response = await fetch(
    mode === "private" ? `${ollamaUrl}/v1/chat/completions` : cloudUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mode === "private" ? {} : { Authorization: `Bearer ${cloudKey}` }),
      },
      body: JSON.stringify({
        model,
        stream: false,
        ...(mode === "cloud" ? { response_format: { type: "json_object" } } : {}),
        ...(mode === "private" ? { format: "json" } : {}),
        messages: [
          { role: "system", content: LEX_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    }
  );
  const responseBody = await response.text();

  if (!response.ok) {
    console.error("Contract scanner model error response", {
      mode,
      model,
      status: response.status,
      body: responseBody,
    });
    throw new Error(`Contract scanner request failed: ${response.status}`);
  }

  return responseBody;
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
