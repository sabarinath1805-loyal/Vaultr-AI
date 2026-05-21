const THINK_BLOCK_REGEX = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
const WEB_SEARCH_MARKER_REGEX = /<web-search-used[^>]*\/>\s*/gi;
const DOCUMENT_ANALYZED_MARKER_REGEX = /<document-analyzed[^>]*\/>/gi;

export function extractThinkContent(content: string) {
  const matches = Array.from(content.matchAll(THINK_BLOCK_REGEX));
  return matches.length > 0
    ? matches
        .map((match) => match[1]?.trim())
        .filter(Boolean)
        .join("\n")
        .trim() || null
    : null;
}

export function stripAssistantMarkup(content: string) {
  return content
    .replace(THINK_BLOCK_REGEX, "")
    .replace(WEB_SEARCH_MARKER_REGEX, "")
    .replace(DOCUMENT_ANALYZED_MARKER_REGEX, "")
    .trim();
}
