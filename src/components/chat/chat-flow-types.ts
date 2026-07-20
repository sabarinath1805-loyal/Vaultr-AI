/**
 * State machine for the chat response pipeline.
 *
 * Transitions:
 *   idle → thinking → typing → streaming → done
 *
 * `thinking` shows the "Lex is thinking" indicator while the upstream LLM
 * has not yet produced tokens. `typing` runs the typewriter effect once
 * the first token arrives. `streaming` is the burst-deliver phase after
 * the typewriter (when the user is reading). `done` is terminal until
 * the next user message flips it back to `idle`.
 */
export type ResponseFlowState =
  | "idle"
  | "thinking"
  | "typing"
  | "streaming"
  | "done";

/**
 * Map a raw upstream error to a user-facing message.
 *
 * Pure / module-scope so it is not reallocated on every `handleResponseError`
 * invocation. The cloud-vs-privacy branch lets the copy reference the
 * user's actual runtime (cloud API vs local Ollama).
 */
export function getChatErrorMessage(err: Error, cloudMode: boolean): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "No internet connection. Check your network and try again.";
  }
  const msg = err.message || "";
  if (msg.includes("503")) return "Lex is under high demand right now. Try again in a moment.";
  if (msg.includes("401") || msg.includes("403")) {
    return "Authentication error. Check your API keys in Settings.";
  }
  if (msg.includes("429")) return "Rate limit reached. Try switching to a different Lex tier.";
  if (/timeout/i.test(msg)) return "Lex timed out. Try again or switch to a faster tier.";
  if (!cloudMode) return "Lex is unavailable. Make sure Ollama is running and try again.";
  return "Something went wrong. Try regenerating or switching models.";
}
