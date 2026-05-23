const THINK_BLOCK_REGEX = /<think\b[^>]*>([\s\S]*?)(?:<\/think>|$)/gi;
const THINK_TAG_REGEX = /<\/?think\b[^>]*>/gi;
const DANGLING_THINK_TAG_REGEX = /<\/?think\b[^>]*$/i;
const WEB_SEARCH_MARKER_REGEX = /<web-search-used[^>]*\/>\s*/gi;
const DOCUMENT_ANALYZED_MARKER_REGEX = /<document-analyzed[^>]*\/>/gi;

export interface ThinkStripState {
  insideThink: boolean;
  pending: string;
  strippedContent: boolean;
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
    .replace(THINK_TAG_REGEX, "")
    .replace(DANGLING_THINK_TAG_REGEX, "")
    .replace(WEB_SEARCH_MARKER_REGEX, "")
    .replace(DOCUMENT_ANALYZED_MARKER_REGEX, "")
    .trim();
}

export function createThinkStripState(): ThinkStripState {
  return { insideThink: false, pending: "", strippedContent: false };
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
      if (closeIndex === -1) {
        const possibleCloseTagStart = getTrailingTagPrefixLength(input, "</think>");
        state.pending = possibleCloseTagStart > 0 ? input.slice(-possibleCloseTagStart) : "";
        state.strippedContent = true;
        return output;
      }
      state.strippedContent = true;
      input = input.slice(closeIndex + "</think>".length);
      state.insideThink = false;
      continue;
    }

    const lowerInput = input.toLowerCase();
    const openIndex = lowerInput.search(/<think\b[^>]*>/);
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
    state.strippedContent = true;
    const openEnd = input.indexOf(">", openIndex);
    if (openEnd === -1) {
      state.pending = input.slice(openIndex);
      return output;
    }
    input = input.slice(openEnd + 1);
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
  const lastOpen = lower.lastIndexOf("<");
  if (lastOpen === -1) return 0;
  const candidate = lower.slice(lastOpen);
  if ("<think".startsWith(candidate) || candidate.startsWith("<think")) {
    return candidate.length;
  }
  return 0;
}

function getTrailingTagPrefixLength(input: string, tag: string) {
  const lower = input.toLowerCase();
  const max = Math.min(tag.length - 1, lower.length);
  for (let length = max; length > 0; length -= 1) {
    if (tag.startsWith(lower.slice(-length))) return length;
  }
  return 0;
}
