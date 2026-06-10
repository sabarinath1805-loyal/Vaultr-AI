/**
 * Hermes Agent Client
 *
 * When HERMES_API_KEY is configured, agent requests are routed through the
 * Hermes gateway which handles multi-step orchestration externally.
 * When the key is absent the agent route falls back to an internal pipeline.
 */

export interface HermesAgentRequest {
  message: string;
  jurisdiction?: string;
  matterId?: string;
  model?: string;
  tools?: string[];
}

/**
 * Returns true when the Hermes gateway is configured via environment variables.
 */
export function isHermesConfigured(): boolean {
  return Boolean(process.env.HERMES_API_KEY);
}

/**
 * Run a request through the Hermes agent gateway and return the response
 * body as a ReadableStream suitable for SSE forwarding.
 *
 * Throws if HERMES_API_KEY is not set or the gateway returns a non-200.
 */
export async function runHermesAgent(
  request: HermesAgentRequest,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.HERMES_API_KEY;
  const baseUrl = process.env.HERMES_BASE_URL || "http://localhost:8080";

  if (!apiKey) {
    throw new Error("HERMES_API_KEY not configured");
  }

  const response = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      message: request.message,
      tools: request.tools || [
        "search_legal_databases",
        "fetch_citation",
        "web_search",
      ],
      model: request.model || "claude-opus-4-8",
      jurisdiction: request.jurisdiction,
      matterId: request.matterId,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`Hermes gateway error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Hermes gateway returned no body");
  }

  return response.body;
}
