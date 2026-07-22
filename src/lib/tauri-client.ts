export const API_KEY_LABELS = {
  GROQ_API_KEY: "Groq API key",
  TAVILY_API_KEY: "Tavily API key",
  GEMINI_API_KEY: "Gemini API key",
  OLLAMA_API_KEY: "Ollama Cloud API key",
} as const;

export const REQUIRED_API_KEY_NAMES = ["GROQ_API_KEY", "TAVILY_API_KEY"] as const;
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
  /**
   * Populated by the Rust `read_files` command when a file was rejected
   * (bad extension, too large, not a regular file, etc.). When non-null, the
   * Rust side has NOT read the file — `bytes` will be empty. The JS layer
   * surfaces this as a hard failure so the user sees the rejection reason.
   */
  error: string | null;
}

// Internal: not exported. The only legitimate source of paths is the dialog
// plugin's `open()` return value above; any other caller forwarding arbitrary
// paths would be a misuse, so the helper is kept off the public surface.
async function createFilesFromTauriPaths(paths: string[]) {
  const { invoke } = await import("@tauri-apps/api/core");
  const files = await invoke<TauriFilePayload[]>("read_files", { paths });

  const errors: string[] = [];
  for (const file of files) {
    if (file.error) {
      errors.push(`${file.filename}: ${file.error}`);
    }
  }
  if (errors.length) {
    throw new Error(
      `Tauri rejected ${errors.length} file${errors.length === 1 ? "" : "s"}: ${errors.join("; ")}`
    );
  }

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
