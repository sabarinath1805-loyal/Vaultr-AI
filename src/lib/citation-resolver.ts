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

/**
 * Resolve a legal citation (e.g. `"Donoghue v Stevenson [1932] AC 562"`) into a snippet of the underlying judgment via the Tavily web search API.
 *
 * @param citation - Free-form citation string. Appended to `" full judgment Singapore law"` server-side.
 * @returns Up to 2000 characters of judgment text, or `null` if Tavily returns no usable content, the `TAVILY_API_KEY` is missing, or the request fails.
 */
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

/**
 * Detect whether a user message is a follow-up question about a previously cited case (e.g. "tell me more about Donoghue v Stevenson").
 *
 * @param userMessage - The raw user-typed message.
 * @returns The extracted case name / subject (without surrounding quotes or trailing punctuation) if the message matches a known follow-up pattern, otherwise `null`.
 */
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
