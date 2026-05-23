const THINK_BLOCK_REGEX = /<think\b[^>]*>([\s\S]*?)(?:<\/think>|$)/gi;
const THINK_TAG_REGEX = /<\/?think\b[^>]*>/gi;
const DANGLING_THINK_TAG_REGEX = /<\/?think\b[^>]*$/i;
const WEB_SEARCH_MARKER_REGEX = /<web-search-used[^>]*\/>\s*/gi;
const DOCUMENT_ANALYZED_MARKER_REGEX = /<document-analyzed[^>]*\/>/gi;
const SEARCH_PREAMBLE_REGEX = /^(?:\s*(?:Search(?:ing)?\s+(?:for|the web for)|I(?:'ll| will)\s+search(?:\s+the\s+web)?\s+for|Let me search(?:\s+the\s+web)?\s+for)[\s\S]*?(?:\n{2,}|(?<=[.!?])\s+))+/i;

export interface ThinkStripState {
  insideThink: boolean;
  pending: string;
  strippedContent: boolean;
  searchPreambleBuffer: string;
  searchPreambleComplete: boolean;
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
    .replace(SEARCH_PREAMBLE_REGEX, "")
    .trim();
}

export function createThinkStripState(): ThinkStripState {
  return {
    insideThink: false,
    pending: "",
    strippedContent: false,
    searchPreambleBuffer: "",
    searchPreambleComplete: false,
  };
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

export function stripAssistantStreamChunk(chunk: string, state: ThinkStripState) {
  return stripSearchPreambleFromStreamChunk(
    stripThinkFromStreamChunk(chunk, state),
    state
  );
}

export function flushThinkStripState(state: ThinkStripState) {
  const output = state.insideThink ? "" : state.pending + state.searchPreambleBuffer;
  state.pending = "";
  state.insideThink = false;
  state.searchPreambleBuffer = "";
  state.searchPreambleComplete = true;
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

function stripSearchPreambleFromStreamChunk(chunk: string, state: ThinkStripState) {
  if (state.searchPreambleComplete || chunk.length === 0) return chunk;

  state.searchPreambleBuffer += chunk;
  const buffer = state.searchPreambleBuffer;
  const trimmedStart = buffer.trimStart().toLowerCase();
  const looksLikeSearchPreamble =
    trimmedStart.startsWith("search for") ||
    trimmedStart.startsWith("searching for") ||
    trimmedStart.startsWith("search the web for") ||
    trimmedStart.startsWith("searching the web for") ||
    trimmedStart.startsWith("i'll search") ||
    trimmedStart.startsWith("i will search") ||
    trimmedStart.startsWith("let me search");

  if (!looksLikeSearchPreamble) {
    state.searchPreambleComplete = true;
    const output = state.searchPreambleBuffer;
    state.searchPreambleBuffer = "";
    return output;
  }

  const sentenceEnd = buffer.search(/[.!?](?:\s|$)/);
  const paragraphBreak = buffer.search(/\n{2,}/);
  const paragraphMatch = paragraphBreak >= 0 ? buffer.match(/\n{2,}/) : null;
  const boundary =
    paragraphBreak >= 0 && paragraphMatch
      ? paragraphBreak + paragraphMatch[0].length
      : sentenceEnd >= 0
        ? sentenceEnd + 1
        : -1;

  if (boundary < 0) {
    state.strippedContent = true;
    return "";
  }

  state.searchPreambleComplete = true;
  state.strippedContent = true;
  state.searchPreambleBuffer = "";
  return buffer.slice(boundary).replace(/^\s+/, "");
}
