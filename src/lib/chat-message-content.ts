// P-11: combined pass. The original code ran three sequential regex passes
// (THINK_BLOCK_REGEX, THINK_TAG_REGEX, DANGLING_THINK_TAG_REGEX) which all
// scanned the same string. The middle pass is redundant — once the first
// pass consumes a well-formed `<think>…</think>` block, there are no stray
// `<think>` / `</think>` tags left for the second pass to find. The dangling
// pass stays because it handles partial trailing tags that the streaming
// state machine intentionally leaves alone for cross-chunk reconstruction.
const THINK_BLOCK_REGEX = /<think\b[^>]*>([\s\S]*?)(?:<\/think>|$)/gi;
const DANGLING_THINK_TAG_REGEX = /<\/?think\b[^>]*$/i;
const WEB_SEARCH_MARKER_REGEX = /<web-search-used[^>]*\/>\s*/gi;
const DOCUMENT_ANALYZED_MARKER_REGEX = /<document-analyzed[^>]*\/>/gi;
const LEGAL_SOURCES_MARKER_REGEX = /<legal-sources[^>]*\/>/gi;
const SEARCH_PREAMBLE_REGEX = /^(?:\s*[\(\["“']?\s*(?:Will perform web search[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Fetching[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Search query:[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Search results(?:\s+fetched)?[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Search(?:ing|\.\.\.)?(?:\s+(?:for|the web for|query:|results(?:\s+fetched)?))?[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|I(?:'ll| will)\s+(?:simulate\s+)?search(?:\s+the\s+web)?[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|I'll simulate[^\n]*(?:[\)\]"”']?\s*(?:\n|$))|Let me search(?:\s+the\s+web)?[^\n]*(?:[\)\]"”']?\s*(?:\n|$))))+/i;
const SYSTEM_PROMPT_LEAK_REGEX = /(?:^|\n)\s*-?\s*(?:Open with a direct one-sentence verdict[^\n]*(?:\n|$)|Break into clearly labelled sections[^\n]*(?:\n|$)|End with a ["“]?Recommended Next Steps["”]? section[^\n]*(?:\n|$)|Simple questions and greetings[^\n]*(?:\n|$)|Complex legal analysis[^\n]*(?:\n|$)|You are Lex, a private AI legal assistant built into Vaultr[^\n]*(?:\n|$)|PERSONALITY:\s*(?:\n|$)|RESPONSE STYLE:\s*(?:\n|$))+/gi;
// Strips inline search-process phrases that survive the preamble filter —
// e.g. "Will perform web search", "(I'll simulate searching)", "Fetching…"
// appearing mid-response or wrapped in parentheses/brackets.
const INLINE_SEARCH_PROCESS_REGEX = /[\(\[]?\s*(?:Will perform web search[^\n.!?]*|I['\u2019]ll simulate(?:\s+search(?:ing)?(?:\s+the\s+web)?)?[^\n.!?]*|\(I['\u2019]ll simulate[^)]*\)|Fetching[^\n.!?]*(?:results?|data|information)?[^\n.!?]*|Search(?:ing)? query\s*:[^\n]*|Search results?(?:\s+fetched)?[^\n]*)\s*[\)\]]?\n?/gi;
// Matches JSON blocks containing tool_code or tool_name fields (raw tool calls leaked by LLM)
const TOOL_CALL_JSON_REGEX = /```(?:json)?\s*\{[\s\S]*?(?:"tool_code"|"tool_name")[\s\S]*?\}\s*```/gi;
const TOOL_CALL_BARE_JSON_REGEX = /\{\s*"(?:tool_code|tool_name)"\s*:[\s\S]*?\}(?:\s*\n?)/gi;

export interface ThinkStripState {
  insideThink: boolean;
  pending: string;
  strippedContent: boolean;
  searchPreambleBuffer: string;
  searchPreambleComplete: boolean;
}

/**
 * Scrub obvious PII / secrets from a value before it reaches console / logs.
 * Walks strings and recurses shallowly into arrays/objects. This is best-effort
 * — not a substitute for never logging PII in the first place.
 */
export function scrubPII(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[max-depth]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
      .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt]")
      .replace(/(?:sk-|gho_|ghp_|ghu_|ghs_|ghr_|pk-|rk-)[A-Za-z0-9_-]{20,}/g, "[api-key]")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (m) => {
        const parts = m.split(".");
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        return m;
      });
  }
  if (Array.isArray(value)) return value.map((v) => scrubPII(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubPII(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Safe wrapper for console.error that scrubs obvious PII before logging.
 * Use this instead of raw console.error in API routes that handle user input.
 */
export function safeError(...args: unknown[]): void {
  console.error(...args.map((a) => scrubPII(a)));
}

/**
 * Extract any `<think>…</think>` content from a complete assistant message as a single concatenated string.
 *
 * @param content - The full assistant message text. May be the concatenation of all streamed chunks.
 * @returns The joined think-block contents trimmed and separated by `\n`, or `null` if no think blocks were found.
 */
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

/**
 * Strip all internal markup and process noise from a complete assistant message in one pass.
 * Combines: think-block removal, web-search markers, document-analyzed markers, legal-sources markers, system-prompt leakage, search-preamble stripping, and tool-call JSON.
 *
 * @param content - The full assistant message.
 * @returns The same text with internal markup removed and preambles stripped.
 */
export function stripAssistantMarkup(content: string) {
  const cleaned = content
    .replace(THINK_BLOCK_REGEX, "")
    .replace(DANGLING_THINK_TAG_REGEX, "")
    .replace(WEB_SEARCH_MARKER_REGEX, "")
    .replace(DOCUMENT_ANALYZED_MARKER_REGEX, "")
    .replace(LEGAL_SOURCES_MARKER_REGEX, "")
    .replace(SYSTEM_PROMPT_LEAK_REGEX, "")
    .replace(SEARCH_PREAMBLE_REGEX, "")
    .replace(INLINE_SEARCH_PROCESS_REGEX, "")
    .replace(TOOL_CALL_JSON_REGEX, "")
    .replace(TOOL_CALL_BARE_JSON_REGEX, "")
    .trim();
  return stripPreamble(cleaned);
}

/**
 * Allocate a fresh streaming state object for the think-block / search-preamble strippers.
 * The state is mutated by `stripThinkFromStreamChunk`, `stripSearchPreambleFromStreamChunk`, and `flushThinkStripState`.
 *
 * @returns A new `ThinkStripState` with all flags at their default (no-strip-yet) values.
 */
export function createThinkStripState(): ThinkStripState {
  return {
    insideThink: false,
    pending: "",
    strippedContent: false,
    searchPreambleBuffer: "",
    searchPreambleComplete: false,
  };
}

/**
 * Streaming-friendly version of think-block stripping. Carries partial-tag state in `state` so that a `<think>` open-tag split across two chunks is still detected.
 *
 * @param chunk - The next text chunk from the model stream.
 * @param state - Mutable state object from `createThinkStripState()`. Updated in place.
 * @returns The text to flush to the client after stripping any think content. May be `""` while inside a think block.
 */
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

/**
 * Apply both think-block and search-preamble strippers to a streaming chunk in one call. Mutates `state`.
 *
 * @param chunk - The next text chunk from the model stream.
 * @param state - Mutable state object from `createThinkStripState()`. Updated in place.
 * @returns The text safe to flush to the client.
 */
export function stripAssistantStreamChunk(chunk: string, state: ThinkStripState) {
  return stripSearchPreambleFromStreamChunk(
    stripThinkFromStreamChunk(chunk, state),
    state
  );
}

/**
 * Flush any pending partial content from the strip state at end-of-stream. Use this when the model indicates the response is complete to make sure any pending preamble / partial-tag content is released.
 *
 * @param state - Mutable state object from `createThinkStripState()`. Resets internal flags.
 * @returns Any text that was held in the state but not yet emitted. Empty string if the state was already complete.
 */
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
  const trimmedStart = buffer
    .trimStart()
    .replace(/^[\(\["“']+\s*/, "")
    .toLowerCase();
  const looksLikeSearchPreamble =
    trimmedStart.startsWith("search for") ||
    trimmedStart.startsWith("searching for") ||
    trimmedStart.startsWith("search the web for") ||
    trimmedStart.startsWith("searching the web for") ||
    trimmedStart.startsWith("search query:") ||
    trimmedStart.startsWith("search results") ||
    trimmedStart.startsWith("will perform web search") ||
    trimmedStart.startsWith("searching...") ||
    trimmedStart.startsWith("fetching") ||
    trimmedStart.startsWith("i'll search") ||
    trimmedStart.startsWith("i'll simulate") ||
    trimmedStart.startsWith("i will search") ||
    trimmedStart.startsWith("let me search") ||
    trimmedStart.startsWith("open with a direct one-sentence verdict") ||
    trimmedStart.startsWith("break into clearly labelled sections") ||
    trimmedStart.startsWith("end with") ||
    trimmedStart.startsWith("simple questions and greetings") ||
    trimmedStart.startsWith("complex legal analysis") ||
    trimmedStart.startsWith("you are lex, a private ai legal assistant") ||
    trimmedStart.startsWith("personality:") ||
    trimmedStart.startsWith("response style:");

  if (!looksLikeSearchPreamble) {
    state.searchPreambleComplete = true;
    const output = state.searchPreambleBuffer;
    state.searchPreambleBuffer = "";
    return output;
  }

  const boundary = getSearchPreambleBoundary(buffer);

  if (boundary < 0) {
    state.strippedContent = true;
    return "";
  }

  state.searchPreambleComplete = true;
  state.strippedContent = true;
  state.searchPreambleBuffer = "";
  return buffer.slice(boundary).replace(/^\s+/, "");
}

function isOnlySearchProcessLine(buffer: string) {
  return /^\s*[\(\["“']?\s*(?:Will perform web search[^\n]*|Fetching[^\n]*|Search(?:ing|\.\.\.)?[^\n]*|Search query:[^\n]*|Search results(?:\s+fetched)?[^\n]*|I'll simulate[^\n]*|I(?:'ll| will)\s+simulate\s+search[^\n]*|Open with a direct one-sentence verdict[^\n]*|Break into clearly labelled sections[^\n]*|End with ["“]?Recommended Next Steps["”]?[^\n]*|Simple questions and greetings[^\n]*|Complex legal analysis[^\n]*|You are Lex, a private AI legal assistant[^\n]*|PERSONALITY:|RESPONSE STYLE:)\s*[\)\]"”']?\s*$/i.test(buffer);
}

function getSearchPreambleBoundary(buffer: string) {
  const lower = buffer.toLowerCase();
  const answerMarkers = [
    "answer:",
    "final answer:",
    "response:",
    "the answer is",
    "in summary",
    "based on",
  ];
  const markerIndex = answerMarkers
    .map((marker) => lower.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (typeof markerIndex === "number") return markerIndex;

  const paragraphBreak = buffer.search(/\n{2,}/);
  if (paragraphBreak >= 0) {
    const paragraphMatch = buffer.slice(paragraphBreak).match(/^\n{2,}/);
    return paragraphBreak + (paragraphMatch?.[0].length || 0);
  }

  const lineMatch = buffer.match(/\n(?!\s*[\(\["“']?\s*(?:will perform web search|fetching|search(?:ing|\.\.\.)?|search query|search results|i'll simulate|i(?:'ll| will)\s+simulate|open with|break into|end with|simple questions|complex legal|you are lex|personality:|response style:))/i);
  if (lineMatch?.index !== undefined) return lineMatch.index + 1;

  return isOnlySearchProcessLine(buffer) ? buffer.length : -1;
}

const PREAMBLE_PATTERNS = [
  /^What[''\u2019]s landed on your desk\?\s*/i,
  /^What[''\u2019]s the matter\?\s*/i,
  /^Talk to me\.\s*/i,
  /^Go ahead\.\s*/i,
  /^Ready when you are\.\s*/i,
  /^Fire away\.\s*/i,
  /^Here[''\u2019]s that .+ you asked for[,.]\s*/i,
  /^Keep in mind[,.]\s*/i,
];

/**
 * Strip the most common one-line conversational preambles Lex models tend to emit ("What's landed on your desk?", "Talk to me.", etc.).
 *
 * @param content - The full assistant message after markup stripping.
 * @returns The text with leading preambles removed. If the result is still very short (< 200 chars), the original content is returned to avoid losing meaningful content.
 */
export function stripPreamble(content: string): string {
  let result = content;
  for (const pattern of PREAMBLE_PATTERNS) {
    result = result.replace(pattern, "");
  }
  const stripped = result.trimStart();
  if (stripped.length > 200) return stripped;
  return content;
}
