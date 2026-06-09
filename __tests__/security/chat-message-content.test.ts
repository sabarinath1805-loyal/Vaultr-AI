import {
  extractThinkContent,
  stripAssistantMarkup,
  stripPreamble,
  createThinkStripState,
  flushThinkStripState,
} from "@/lib/chat-message-content";

describe("chat-message-content helpers", () => {
  describe("extractThinkContent", () => {
    it("extracts think block with proper tag format", () => {
      const content = `<think>I've analyzed the contract</think>\n\nHere is my response.`;
      const result = extractThinkContent(content);
      expect(result).toBe("I've analyzed the contract");
    });

    it("returns null when no think block", () => {
      const content = "This is a normal response without any think tags.";
      expect(extractThinkContent(content)).toBe(null);
    });

    it("handles multiple think blocks", () => {
      const content = `<think>First analysis</think> Response <think>Second thought</think>`;
      const result = extractThinkContent(content);
      expect(result).toContain("First analysis");
      expect(result).toContain("Second thought");
    });

    it("handles think blocks with attributes", () => {
      const content = `<think>Thinking through the legal implications...</thought>\n\nHere is the answer.`;
      const result = extractThinkContent(content);
      expect(result).toContain("Thinking through");
    });
  });

  describe("stripAssistantMarkup", () => {
    it("removes think blocks", () => {
      const content = `Hello<think>internal thinking</think> Real response.`;
      const result = stripAssistantMarkup(content);
      expect(result).not.toContain("think");
      expect(result).toContain("Real response");
    });

    it("removes web search markers", () => {
      const content = "Response <web-search-used/> content.";
      const result = stripAssistantMarkup(content);
      expect(result).not.toContain("web-search");
    });

    it("returns trimmed content", () => {
      const content = "  Some response  ";
      const result = stripAssistantMarkup(content);
      expect(result).toBe("Some response");
    });
  });

  describe("stripPreamble", () => {
    it("strips common preambles and keeps long content", () => {
      const longContent = "A".repeat(250);
      const result = stripPreamble(`What's landed on your desk? ${longContent}`);
      expect(result).not.toContain("What's landed");
      expect(result).toHaveLength(250);
    });

    it("keeps short content to avoid losing meaning", () => {
      const shortContent = "Hello world";
      const result = stripPreamble(`What's landed on your desk? ${shortContent}`);
      expect(result).toContain("What's landed"); // Kept because < 200 chars
    });
  });

  describe("streaming think stripper", () => {
    it("handles simple content without think tags", () => {
      const state = createThinkStripState();
      const { stripThinkFromStreamChunk } = require("@/lib/chat-message-content");
      const output = stripThinkFromStreamChunk("Hello world", state);
      expect(output).toBe("Hello world");
      expect(state.insideThink).toBe(false);
    });

    it("flushThinkStripState returns searchPreambleBuffer content", () => {
      const state = createThinkStripState();
      state.searchPreambleBuffer = "Some preamble";
      const pending = flushThinkStripState(state);
      expect(pending).toBe("Some preamble");
    });

    it("discards pending think content when insideThink is true", () => {
      const state = createThinkStripState();
      state.insideThink = true;
      state.pending = "unfinished think";
      state.searchPreambleBuffer = "";

      const pending = flushThinkStripState(state);
      expect(pending).toBe(""); // Discarded
    });
  });
});