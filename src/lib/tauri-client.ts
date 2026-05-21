export const API_KEY_LABELS = {
  GROQ_API_KEY: "Groq API key",
  SERPER_API_KEY: "Serper API key",
  GEMINI_API_KEY: "Gemini API key",
  OLLAMA_API_KEY: "Ollama Cloud API key",
} as const;

export const REQUIRED_API_KEY_NAMES = ["GROQ_API_KEY", "SERPER_API_KEY"] as const;
export const OPTIONAL_API_KEY_NAMES = ["GEMINI_API_KEY", "OLLAMA_API_KEY"] as const;
export const ALL_API_KEY_NAMES = [
  ...REQUIRED_API_KEY_NAMES,
  ...OPTIONAL_API_KEY_NAMES,
] as const;

export type ClientApiKeyName = (typeof ALL_API_KEY_NAMES)[number];
export type ClientApiKeyValues = Partial<Record<ClientApiKeyName, string>>;
export type ClientApiKeyStatus = Record<ClientApiKeyName, boolean>;

export function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
