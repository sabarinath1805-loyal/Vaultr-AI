import { describe, expect, it } from "vitest";
import {
  classifyTabularCellProvenance,
  parseSourceDocumentVersionIds,
  sourceDocumentVersionIdsForPersistence,
} from "../tabularProvenance";

const row = {
  id: "row-1",
  document_id: "doc-1",
};

function version(
  id: string,
  processing_state: unknown = "ready",
  document_id = "doc-1",
) {
  return { id, document_id, processing_state, deleted_at: null };
}

describe("Tabular Review source-version provenance", () => {
  it("accepts only the exact current trusted source version", () => {
    expect(
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: ["v1"],
        documents: [{ id: "doc-1", current_version_id: "v1" }],
        versions: [version("v1")],
      }),
    ).toMatchObject({ state: "trusted", sourceDocumentVersionIds: ["v1"] });
  });

  it.each([
    ["pending_scan", "pending"],
    ["quarantined", "quarantined"],
    ["failed", "failed"],
    ["unknown", "unverified"],
  ])("blocks a source in %s state", (processing_state, expectedState) => {
    expect(
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: ["v1"],
        documents: [{ id: "doc-1", current_version_id: "v1" }],
        versions: [version("v1", processing_state)],
      }).state,
    ).toBe(expectedState);
  });

  it("marks an older trusted version stale after the active version changes", () => {
    expect(
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: ["v1"],
        documents: [{ id: "doc-1", current_version_id: "v2" }],
        versions: [version("v1"), version("v2")],
      }).state,
    ).toBe("stale");
  });

  it("fails closed for missing, malformed, or mismatched provenance", () => {
    expect(parseSourceDocumentVersionIds(null)).toBeNull();
    expect(parseSourceDocumentVersionIds(["v1", "v1"])).toBeNull();
    expect(
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: ["v1"],
        documents: [{ id: "doc-1", current_version_id: "v1" }],
        versions: [],
      }).state,
    ).toBe("unverified");
    expect(
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: ["other-version"],
        documents: [{ id: "doc-1", current_version_id: "other-version" }],
        versions: [version("other-version", "ready", "other-doc")],
      }).state,
    ).toBe("unverified");
  });

  it("does not invent provenance for an empty source snapshot", () => {
    expect(sourceDocumentVersionIdsForPersistence([])).toBeNull();
    expect(sourceDocumentVersionIdsForPersistence(["v1", "v2"])).toEqual([
      "v1",
      "v2",
    ]);
  });
});
