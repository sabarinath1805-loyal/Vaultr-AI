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
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || navigator.userAgent.includes("Tauri"))
  );
}

export async function selectTauriDocumentFiles() {
  if (!isTauriDesktop()) return null;

  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "Documents",
        extensions: ["pdf", "doc", "docx", "txt"],
      },
    ],
  });

  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return createFilesFromTauriPaths(paths);
}

interface TauriFilePayload {
  filename: string;
  bytes: number[];
}

async function createFilesFromTauriPaths(paths: string[]) {
  const { invoke } = await import("@tauri-apps/api/core");
  const files = await invoke<TauriFilePayload[]>("read_files", { paths });
  return files.map((file) => {
    const bytes = new Uint8Array(file.bytes);
    return new File([bytes], file.filename, { type: inferDocumentMimeType(file.filename) });
  });
}

function inferDocumentMimeType(filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "text/plain";
}
