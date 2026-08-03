/** Ask the server to reduce a user message to a focused legal-search query. */
export async function extractLegalSearchQuery(
  userMessage: string
): Promise<string> {
  try {
    const response = await fetch("/api/extract-legal-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return userMessage;
    const data = await response.json();
    return data.query || userMessage;
  } catch {
    return userMessage;
  }
}
