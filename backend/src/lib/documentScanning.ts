import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export type DocumentScanStatus = "clean" | "quarantined" | "unavailable" | "error" | "bypassed";
export type DocumentProcessingState =
  | "uploaded"
  | "pending_scan"
  | "clean"
  | "quarantined"
  | "processing"
  | "ready"
  | "failed";

export type DocumentScanResult = {
  status: DocumentScanStatus;
  provider: string | null;
  detail?: string;
};

const SCAN_TIMEOUT_MS = 120_000;

function scannerRequired(env = process.env) {
  return env.NODE_ENV === "production" || env.DOCUMENT_SCANNER_REQUIRED === "true";
}

function scannerBinary(env = process.env) {
  const value = env.DOCUMENT_SCANNER_BINARY?.trim();
  return value || null;
}

function safeDetail(value: unknown) {
  const text = value instanceof Error ? value.message : String(value);
  return text.slice(0, 500);
}

/**
 * Vendor-neutral scanner boundary. A deployment supplies an approved scanner
 * executable and optional JSON argv template containing `{file}`. No shell is
 * used, and the input is written to a private temporary directory.
 */
export async function scanDocumentBuffer(
  bytes: Buffer,
  filename: string,
  env = process.env,
): Promise<DocumentScanResult> {
  const binary = scannerBinary(env);
  if (!binary) {
    if (!scannerRequired(env)) {
      return { status: "bypassed", provider: "development-bypass" };
    }
    return { status: "unavailable", provider: null, detail: "Document scanner is not configured." };
  }

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "mike-scan-"));
  try {
    await fs.chmod(workspace, 0o700).catch(() => undefined);
    const filePath = path.join(workspace, `${crypto.randomUUID()}-${path.basename(filename)}`);
    await fs.writeFile(filePath, bytes, { mode: 0o600 });
    let args: string[] = [filePath];
    const configuredArgs = env.DOCUMENT_SCANNER_ARGS_JSON?.trim();
    if (configuredArgs) {
      try {
        const parsed = JSON.parse(configuredArgs);
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
          throw new Error("DOCUMENT_SCANNER_ARGS_JSON must be an array of strings");
        }
        args = parsed.map((item) => item.replaceAll("{file}", filePath));
      } catch (error) {
        return { status: "error", provider: binary, detail: safeDetail(error) };
      }
    }
    try {
      await execFileAsync(binary, args, {
        timeout: SCAN_TIMEOUT_MS,
        killSignal: "SIGTERM",
        windowsHide: true,
        maxBuffer: 64 * 1024,
      });
      return { status: "clean", provider: binary };
    } catch (error) {
      const exitCode = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : null;
      if (exitCode === 1) return { status: "quarantined", provider: binary, detail: "Scanner rejected the document." };
      return { status: "error", provider: binary, detail: safeDetail(error) };
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function scanResultProcessingState(result: DocumentScanResult): DocumentProcessingState {
  if (result.status === "clean" || result.status === "bypassed") return "clean";
  if (result.status === "quarantined") return "quarantined";
  return "failed";
}

export function isDocumentProcessable(scanStatus: DocumentScanStatus, processingState: DocumentProcessingState) {
  return (scanStatus === "clean" || scanStatus === "bypassed") && processingState === "clean";
}
