import { getConfiguredApiKey } from "@/lib/tauri-env";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
}

export async function resolveCitation(citation: string): Promise<string | null> {
  const apiKey = getConfiguredApiKey("TAVILY_API_KEY");
  if (!apiKey?.trim()) return null;

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query: `${citation} full judgment Singapore law`,
        search_depth: "advanced",
        include_raw_content: true,
        max_results: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data: TavilyResponse = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    const text = result.raw_content || result.content || "";
    if (!text || text.length < 50) return null;

    return text.slice(0, 2000);
  } catch {
    console.warn(`[Citation Resolver] Failed to resolve: ${citation}`);
    return null;
  }
}

const CASE_FOLLOW_UP_PATTERNS = [
  /tell me more about (.+)/i,
  /what did the court say in (.+)/i,
  /expand on (.+)/i,
  /what happened in (.+)/i,
  /more detail on (.+)/i,
  /explain (.+?) (?:case|judgment|decision)/i,
  /can you elaborate on (.+)/i,
];

export function detectCaseFollowUp(userMessage: string): string | null {
  const trimmed = userMessage.trim().replace(/[?.!]+$/, "");
  for (const pattern of CASE_FOLLOW_UP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}
