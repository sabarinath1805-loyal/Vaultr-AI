/**
 * Streaming-specific tests for `lib/chat-message-content`.
 *
 * The point of this suite (vs. `chat-message-content.test.ts`) is the
 * split-across-chunks cases: the stream may deliver `<think` without the
 * closing `>` first, the body of a think block may be split into dozens
 * of micro-chunks, and the search preamble may be emitted piecemeal.
 *
 * All of those need to round-trip through the strip state machine
 * correctly. If they don't, the user either sees the model's internal
 * monologue in their chat, or loses the answer entirely.
 */

import {
  createThinkStripState,
  stripAssistantStreamChunk,
  stripThinkFromStreamChunk,
  flushThinkStripState,
  type ThinkStripState,
} from "@/lib/chat-message-content";

function fresh(): ThinkStripState {
  return createThinkStripState();
}

describe("stripThinkFromStreamChunk — streaming think block", () => {
  it("holds a complete think block and emits nothing until the close tag", () => {
    const state = fresh();
    const out1 = stripThinkFromStreamChunk("<think>hidden reasoning</think>", state);
    expect(out1).toBe("");
    expect(state.strippedContent).toBe(true);
    expect(state.insideThink).toBe(false);
  });

  it("emits text after a complete think block in the same chunk", () => {
    const state = fresh();
    const out = stripThinkFromStreamChunk(
      "<think>hidden</think> real answer",
      state
    );
    expect(out).toBe(" real answer");
    expect(state.strippedContent).toBe(true);
  });

  it("survives the open-tag being split across two chunks", () => {
    const state = fresh();
    expect(stripThinkFromStreamChunk("hel<thi", state)).toBe("hel");
    // The state should hold the partial tag in `pending`.
    expect(state.pending).toBe("<thi");
    expect(state.insideThink).toBe(false);

    // Next chunk completes the tag — content should now disappear into the think block.
    const out = stripThinkFromStreamChunk("nk>secret</think> visible", state);
    expect(out).toBe(" visible");
    expect(state.strippedContent).toBe(true);
  });

  it("flushes a partial open-tag at end-of-stream rather than leaking it", () => {
    const state = fresh();
    stripThinkFromStreamChunk("plain text <thi", state);
    // Stream ends mid-tag — flushThinkStripState should release the pending tail.
    const flushed = flushThinkStripState(state);
    expect(flushed).toContain("<thi");
  });
});

describe("stripAssistantStreamChunk — search preamble + think interaction", () => {
  it("eats a search preamble emitted as one chunk", () => {
    const state = fresh();
    const out = stripAssistantStreamChunk(
      "Searching the web for Singapore case law.\n\nThe answer is 42.",
      state
    );
    expect(out).not.toMatch(/^Searching/i);
    expect(out).toMatch(/The answer is/);
    expect(state.strippedContent).toBe(true);
  });

  it("strips a preamble that is unambiguously a preamble phrase", () => {
    const state = fresh();
    // "Search query:" is an unambiguous preamble prefix — the stripper must eat it.
    expect(stripAssistantStreamChunk("Search query:", state)).toBe("");
    expect(
      stripAssistantStreamChunk(" employment law Singapore.\n\nNegligence.", state)
    ).toMatch(/Negligence/);
  });

  it("preserves legitimate non-preamble text immediately", () => {
    const state = fresh();
    const out = stripAssistantStreamChunk(
      "Negligence requires duty of care.",
      state
    );
    expect(out).toBe("Negligence requires duty of care.");
  });

  it("flushThinkStripState marks the stripper as complete", () => {
    // After the stream ends, even an empty preamble buffer should mark the
    // stripper as complete so subsequent chunks pass through untouched.
    const state = fresh();
    expect(state.searchPreambleComplete).toBe(false);
    flushThinkStripState(state);
    expect(state.searchPreambleComplete).toBe(true);
    // Subsequent chunks should pass through verbatim — no more preamble stripping.
    expect(stripAssistantStreamChunk("hello", state)).toBe("hello");
  });
});