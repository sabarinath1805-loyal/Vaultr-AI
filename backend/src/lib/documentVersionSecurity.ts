import {
  isDocumentProcessable,
  scanDocumentBuffer,
  scanResultProcessingState,
  type DocumentProcessingState,
  type DocumentScanResult,
} from "./documentScanning";

export const UNTRUSTED_DOCUMENT_VERSION_STATE = "pending_scan" as const;

export type DocumentVersionTrustClass =
  | "pending"
  | "trusted"
  | "quarantined"
  | "failed"
  | "processing"
  | "unknown";

/**
 * Classify a persisted version state without coercing legacy or malformed
 * values into trust. `clean` is retained as a trusted state for compatibility
 * with versions that completed scanning before final processing was recorded;
 * new write paths promote versions to `ready` only after their scan succeeds.
 */
export function classifyDocumentVersionState(
  state: unknown,
): DocumentVersionTrustClass {
  if (state === "clean" || state === "ready") return "trusted";
  if (state === "uploaded" || state === "pending_scan") return "pending";
  if (state === "quarantined") return "quarantined";
  if (state === "failed") return "failed";
  if (state === "processing") return "processing";
  return "unknown";
}

/**
 * The single trusted-content predicate for document versions. Unknown,
 * missing, pending, processing, failed, and quarantined states fail closed.
 */
export function isDocumentVersionTrusted(
  state: unknown,
): state is Extract<DocumentProcessingState, "clean" | "ready"> {
  return classifyDocumentVersionState(state) === "trusted";
}

export class UntrustedDocumentVersionError extends Error {
  readonly processingState: unknown;

  constructor(processingState: unknown) {
    super("Document version is not trusted for content processing.");
    this.name = "UntrustedDocumentVersionError";
    this.processingState = processingState;
  }
}

export function assertDocumentVersionTrusted(state: unknown): asserts state is
  Extract<DocumentProcessingState, "clean" | "ready"> {
  if (!isDocumentVersionTrusted(state)) {
    throw new UntrustedDocumentVersionError(state);
  }
}

export async function scanVersionContent(
  bytes: Buffer,
  filename: string,
  env = process.env,
): Promise<{
  scan: DocumentScanResult;
  processingState: DocumentProcessingState;
  trusted: boolean;
}> {
  const scan = await scanDocumentBuffer(bytes, filename, env);
  const processingState = scanResultProcessingState(scan);
  return {
    scan,
    processingState,
    trusted: isDocumentProcessable(scan.status, processingState),
  };
}
