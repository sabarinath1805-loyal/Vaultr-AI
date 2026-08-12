import JSZip from "jszip";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { MAX_ZIP_ENTRIES, MAX_DECLARED_UNCOMPRESSED_BYTES } from "./fileValidation";

let _convert:
  | ((buf: Buffer, ext: string, filter: undefined, workspace: string) => Promise<Buffer>)
  | null = null;
let _sofficeBinaryPaths: string[] | null = null;
export const MAX_CONVERSION_INPUT_BYTES = 100 * 1024 * 1024;
export const DEFAULT_CONVERSION_TIMEOUT_MS = 120_000;
export const DEFAULT_CONVERSION_OUTPUT_BYTES = 250 * 1024 * 1024;

function conversionOutputBytes() {
  const configured = Number(process.env.DOCUMENT_CONVERSION_MAX_OUTPUT_BYTES);
  return Number.isFinite(configured) && configured >= 1024 * 1024 && configured <= 500 * 1024 * 1024
    ? configured
    : DEFAULT_CONVERSION_OUTPUT_BYTES;
}

function conversionTimeoutMs() {
  const configured = Number(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5_000 && configured <= 300_000
    ? configured
    : DEFAULT_CONVERSION_TIMEOUT_MS;
}

function executablePath(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveSofficeBinaryPaths(): string[] {
  if (_sofficeBinaryPaths) return _sofficeBinaryPaths;

  const candidates = new Set<string>();
  for (const envName of [
    "SOFFICE_BINARY_PATH",
    "LIBREOFFICE_BINARY_PATH",
    "LIBRE_OFFICE_EXE",
  ]) {
    const value = process.env[envName]?.trim();
    if (value) candidates.add(value);
  }

  const pathDirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const dir of pathDirs) {
    candidates.add(path.join(dir, "soffice"));
    candidates.add(path.join(dir, "libreoffice"));
  }

  for (const filePath of [
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/snap/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    "/opt/libreoffice7.6/program/soffice",
  ]) {
    candidates.add(filePath);
  }

  _sofficeBinaryPaths = [...candidates].filter(executablePath);
  return _sofficeBinaryPaths;
}

async function getConvert() {
  if (!_convert) {
    const libre = await import("libreoffice-convert");
    const convertWithOptions = libre.default.convertWithOptions.bind(
      libre.default,
    ) as (
      buf: Buffer,
      ext: string,
      filter: undefined,
      options: {
        sofficeBinaryPaths?: string[];
        tmpOptions?: { dir?: string; mode?: number; unsafeCleanup?: boolean };
        execOptions?: { timeout?: number; killSignal?: string; windowsHide?: boolean };
        asyncOptions?: { times?: number; interval?: number };
      },
      callback?: (err: Error | null, result: Buffer) => void,
    ) => Promise<Buffer> | void;
    _convert = (buf, ext, filter, workspace) =>
      new Promise<Buffer>((resolve, reject) => {
        try {
          const maybePromise = convertWithOptions(
            buf,
            ext,
            filter,
            {
              sofficeBinaryPaths: resolveSofficeBinaryPaths(),
              tmpOptions: { dir: workspace, mode: 0o700, unsafeCleanup: true },
              execOptions: {
                timeout: conversionTimeoutMs(),
                killSignal: "SIGTERM",
                windowsHide: true,
              },
              asyncOptions: { times: 2, interval: 250 },
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            },
          );
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(resolve, reject);
          }
        } catch (err) {
          reject(err);
        }
      });
  }
  return _convert;
}

/**
 * Some older Windows/Word archives store .docx entries with backslash
 * separators (e.g. `word\document.xml`). Mammoth and LibreOffice both look
 * up entries by exact string and miss those files, producing empty output
 * or conversion failures. Rewrite any such entries to the canonical
 * forward-slash form before handing the buffer off.
 */
export async function normalizeDocxZipPaths(buffer: Buffer): Promise<Buffer> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return buffer;
  }
  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error("Office archive has too many entries");
  }
  const declaredBytes = entries.reduce((total, name) => {
    const size = (zip.files[name] as unknown as { _data?: { uncompressedSize?: number } })._data
      ?.uncompressedSize;
    return total + (typeof size === "number" && Number.isFinite(size) ? size : 0);
  }, 0);
  if (declaredBytes > MAX_DECLARED_UNCOMPRESSED_BYTES) {
    throw new Error("Office archive expands beyond the resource limit");
  }
  const renames: [string, string][] = [];
  zip.forEach((relativePath) => {
    if (relativePath.includes("\\")) {
      renames.push([relativePath, relativePath.replace(/\\/g, "/")]);
    }
  });
  if (renames.length === 0) return buffer;
  for (const [oldPath, newPath] of renames) {
    const entry = zip.file(oldPath);
    if (!entry) continue;
    const content = await entry.async("nodebuffer");
    zip.remove(oldPath);
    zip.file(newPath, content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Convert a DOCX/DOC buffer to PDF using LibreOffice.
 * Throws if LibreOffice is not installed or conversion fails.
 */
export async function docxToPdf(buffer: Buffer): Promise<Buffer> {
  if (buffer.byteLength > MAX_CONVERSION_INPUT_BYTES) {
    throw new Error("Document exceeds the conversion input limit");
  }
  if (resolveSofficeBinaryPaths().length === 0) {
    throw new Error(
      "LibreOffice/soffice binary was not found. Ensure Railway uses backend/nixpacks.toml or set SOFFICE_BINARY_PATH/LIBREOFFICE_BINARY_PATH.",
    );
  }
  const convert = await getConvert();
  const normalized = await normalizeDocxZipPaths(buffer);
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), "mike-conversion-"));
  try {
    await fsp.chmod(workspace, 0o700).catch(() => undefined);
    const output = await convert(normalized, ".pdf", undefined, workspace);
    return validateConvertedPdf(output);
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Validate converter output before it can be stored or shown to a user. */
export function validateConvertedPdf(output: Buffer): Buffer {
  if (!output.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("LibreOffice returned an invalid PDF output");
  }
  if (output.byteLength > conversionOutputBytes()) {
    throw new Error("LibreOffice returned an oversized PDF output");
  }
  return output;
}

export function convertedPdfKey(userId: string, docId: string): string {
  return `converted-pdfs/${userId}/${docId}.pdf`;
}
