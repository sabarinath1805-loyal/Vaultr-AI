import { describe, expect, it } from "vitest";
import {
  canTransitionDocumentState,
  isDocumentProcessingTerminal,
  processingErrorDetail,
  retryDocumentProcessing,
} from "../documentRecovery";

describe("document processing recovery", () => {
  it("allows only explicit state-machine transitions", () => {
    expect(canTransitionDocumentState("pending_scan", "quarantined")).toBe(true);
    expect(canTransitionDocumentState("processing", "ready")).toBe(true);
    expect(canTransitionDocumentState("ready", "quarantined")).toBe(false);
    expect(canTransitionDocumentState("quarantined", "processing")).toBe(false);
  });

  it("requires an explicit review before retrying quarantined content", () => {
    expect(retryDocumentProcessing("failed")).toEqual({
      retryable: true,
      nextState: "pending_scan",
    });
    expect(retryDocumentProcessing("quarantined").retryable).toBe(false);
    expect(
      retryDocumentProcessing("quarantined", { explicitQuarantineReview: true }),
    ).toEqual({ retryable: true, nextState: "pending_scan" });
    expect(isDocumentProcessingTerminal("quarantined")).toBe(true);
    expect(isDocumentProcessingTerminal("ready")).toBe(true);
  });

  it("caps persisted failure details", () => {
    expect(processingErrorDetail(new Error("x"))).toBe("x");
    expect(processingErrorDetail("a".repeat(700))).toHaveLength(500);
  });
});
