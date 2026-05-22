const THINK_BLOCK_REGEX = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
const WEB_SEARCH_MARKER_REGEX = /<web-search-used[^>]*\/>\s*/gi;
const DOCUMENT_ANALYZED_MARKER_REGEX = /<document-analyzed[^>]*\/>/gi;

export interface ThinkStripState {
  insideThink: boolean;
  pending: string;
}

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

export function createThinkStripState(): ThinkStripState {
  return { insideThink: false, pending: "" };
}

export function stripThinkFromStreamChunk(
  chunk: string,
  state: ThinkStripState
) {
  let input = state.pending + chunk;
  state.pending = "";
  let output = "";

  while (input.length > 0) {
    if (state.insideThink) {
      const closeIndex = input.toLowerCase().indexOf("</think>");
      if (closeIndex === -1) return output;
      input = input.slice(closeIndex + "</think>".length);
      state.insideThink = false;
      continue;
    }

    const openIndex = input.toLowerCase().indexOf("<think>");
    if (openIndex === -1) {
      const possibleTagStart = getTrailingThinkTagPrefixLength(input);
      if (possibleTagStart > 0) {
        output += input.slice(0, -possibleTagStart);
        state.pending = input.slice(-possibleTagStart);
      } else {
        output += input;
      }
      return output;
    }

    output += input.slice(0, openIndex);
    input = input.slice(openIndex + "<think>".length);
    state.insideThink = true;
  }

  return output;
}

export function flushThinkStripState(state: ThinkStripState) {
  const output = state.insideThink ? "" : state.pending;
  state.pending = "";
  state.insideThink = false;
  return output;
}

function getTrailingThinkTagPrefixLength(input: string) {
  const lower = input.toLowerCase();
  const tag = "<think>";
  const max = Math.min(tag.length - 1, lower.length);
  for (let length = max; length > 0; length -= 1) {
    if (tag.startsWith(lower.slice(-length))) return length;
  }
  return 0;
}
