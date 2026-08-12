import type { DocumentProcessingState } from "./documentScanning";

const transitions: Record<DocumentProcessingState, readonly DocumentProcessingState[]> = {
  uploaded: ["pending_scan", "failed"],
  pending_scan: ["clean", "quarantined", "failed"],
  clean: ["processing", "failed"],
  quarantined: ["pending_scan"],
  processing: ["ready", "failed"],
  ready: ["processing", "failed"],
  failed: ["pending_scan"],
};

export function canTransitionDocumentState(
  from: DocumentProcessingState,
  to: DocumentProcessingState,
) {
  return from === to || transitions[from].includes(to);
}

export function isDocumentProcessingTerminal(state: DocumentProcessingState) {
  return state === "ready" || state === "quarantined";
}

/**
 * Returns the safe state for a deliberate retry. Quarantine is never retried
 * implicitly: an operator or a new upload must explicitly authorize a fresh
 * scan after the original scanner rejection.
 */
export function retryDocumentProcessing(
  state: DocumentProcessingState,
  options: { explicitQuarantineReview?: boolean } = {},
) {
  if (state === "failed" || state === "pending_scan" || state === "processing") {
    return { retryable: true, nextState: "pending_scan" as const };
  }
  if (state === "quarantined" && options.explicitQuarantineReview) {
    return { retryable: true, nextState: "pending_scan" as const };
  }
  return { retryable: false, nextState: state };
}

export function processingErrorDetail(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.slice(0, 500);
}
