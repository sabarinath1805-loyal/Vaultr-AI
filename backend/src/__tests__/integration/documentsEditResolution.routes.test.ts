import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";

const state = vi.hoisted(() => ({
  tables: {} as Record<string, { data: any; error: any }>,
  inserts: [] as { table: string; payload: any }[],
  updates: [] as { table: string; payload: any }[],
  pointerSucceeds: true,
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  scanVersionContent: vi.fn(),
  resolveTrackedChange: vi.fn(),
}));

function resultFor(table: string) {
  return state.tables[table] ?? { data: null, error: null };
}

function mockDb() {
  return {
    from(table: string) {
      let operation = "select";
      const q: Record<string, any> = {};
      q.select = vi.fn(() => q);
      q.eq = vi.fn(() => q);
      q.not = vi.fn(() => q);
      q.order = vi.fn(() => q);
      q.limit = vi.fn(() => q);
      q.update = vi.fn((payload: any) => {
        operation = "update";
        state.updates.push({ table, payload });
        return q;
      });
      q.insert = vi.fn((payload: any) => {
        operation = "insert";
        state.inserts.push({ table, payload });
        return q;
      });
      q.single = vi.fn(async () => {
        if (table === "document_versions" && operation === "insert") {
          return {
            data: {
              id: "v2",
              version_number: 2,
              source: "user_accept",
              filename: "agreement.docx",
            },
            error: null,
          };
        }
        return resultFor(table);
      });
      q.maybeSingle = vi.fn(async () => {
        if (table === "document_versions" && operation === "select") {
          return {
            data: {
              id: "v2",
              document_id: "doc-1",
              processing_state: "ready",
              deleted_at: null,
            },
            error: null,
          };
        }
        if (table === "documents" && operation === "update") {
          return state.pointerSucceeds
            ? {
                data: { id: "doc-1", current_version_id: "v2" },
                error: null,
              }
            : { data: null, error: null };
        }
        return resultFor(table);
      });
      q.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve(resultFor(table)).then(resolve, reject);
      return q;
    },
  };
}

vi.mock("../../lib/supabase", () => ({
  createServerSupabase: vi.fn(() => mockDb()),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: (_req: unknown, res: any, next: () => void) => {
    res.locals.userId = "u1";
    res.locals.userEmail = "u1@test.local";
    next();
  },
  requireMfaIfEnrolled: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

vi.mock("../../lib/access", async () => ({
  ensureDocAccess: vi.fn(async () => ({ ok: true, isOwner: true })),
  ensureReviewAccess: vi.fn(async () => ({ ok: true, isOwner: true })),
  checkProjectAccess: vi.fn(async () => ({ ok: true, isOwner: true })),
  filterAccessibleDocumentIds: vi.fn(async (ids: string[]) => ids),
}));

vi.mock("../../lib/storage", () => ({
  buildContentDisposition: vi.fn(() => "inline"),
  downloadFile: vi.fn(async () => new ArrayBuffer(8)),
  deleteFile: state.deleteFile,
  getSignedUrl: vi.fn(async () => "https://storage.test/file"),
  storageKey: vi.fn(() => "documents/u1/doc-1/source.docx"),
  uploadFile: state.uploadFile,
  versionStorageKey: vi.fn(
    (_userId: string, _documentId: string, slug: string) =>
      `documents/u1/doc-1/versions/${slug}.docx`,
  ),
}));

vi.mock("../../lib/convert", async () => ({
  docxToPdf: vi.fn(async () => {
    throw new Error("converter unavailable in route unit test");
  }),
  convertedPdfKey: vi.fn(() => "converted-pdfs/u1/doc-1.pdf"),
}));

vi.mock("../../lib/docxTrackedChanges", () => ({
  extractTrackedChangeIds: vi.fn(),
  resolveTrackedChange: state.resolveTrackedChange,
}));

vi.mock("../../lib/documentScanning", async () => ({
  scanDocumentBuffer: vi.fn(),
  scanResultProcessingState: vi.fn(() => "clean"),
  isDocumentProcessable: vi.fn(() => true),
  scanVersionContent: state.scanVersionContent,
}));

vi.mock("../../lib/documentVersionSecurity", () => ({
  isDocumentVersionTrusted: vi.fn((state: unknown) =>
    state === "ready" || state === "clean",
  ),
  scanVersionContent: state.scanVersionContent,
  UNTRUSTED_DOCUMENT_VERSION_STATE: "pending_scan",
}));

vi.mock("../../lib/documentVersions", async () => ({
  attachActiveVersionPaths: vi.fn(async () => []),
  attachLatestVersionNumbers: vi.fn(async () => []),
  contentSha256: vi.fn(() => "hash-resolved"),
  loadActiveVersion: vi.fn(async () => ({
    id: "v1",
    storage_path: "documents/u1/doc-1/source.docx",
    pdf_storage_path: null,
    version_number: 1,
    filename: "agreement.docx",
    source: "assistant_edit",
    file_type: "docx",
    size_bytes: 8,
    page_count: null,
    processing_state: "ready",
  })),
}));

vi.mock("../../lib/auditEvents", () => ({
  recordAuditEvent: vi.fn(async () => undefined),
}));

vi.mock("../../lib/downloadTokens", () => ({
  buildDownloadUrl: vi.fn((path: string) => `http://download.test/${path}`),
}));

import { app } from "../../app";

describe("tracked-edit resolution security boundary", () => {
  beforeEach(() => {
    state.tables = {
      document_edits: {
        data: {
          id: "edit-1",
          document_id: "doc-1",
          change_id: "change-1",
          del_w_id: "del-1",
          ins_w_id: null,
          status: "pending",
        },
        error: null,
      },
      documents: {
        data: {
          id: "doc-1",
          current_version_id: "v1",
          user_id: "u1",
          project_id: null,
        },
        error: null,
      },
      document_versions: { data: [], error: null },
      document_edits_count: { data: [], error: null },
    };
    state.inserts = [];
    state.updates = [];
    state.pointerSucceeds = true;
    state.uploadFile.mockReset().mockResolvedValue(undefined);
    state.deleteFile.mockReset().mockResolvedValue(undefined);
    state.scanVersionContent.mockReset().mockResolvedValue({
      scan: { status: "clean", provider: "test" },
      processingState: "clean",
      trusted: true,
    });
    state.resolveTrackedChange.mockReset().mockResolvedValue({
      bytes: Buffer.from("resolved bytes"),
      found: true,
    });
  });

  it("creates an untrusted new version, scans it, then advances the pointer", async () => {
    const response = await request(app)
      .post("/single-documents/doc-1/edits/edit-1/accept")
      .set("Authorization", "Bearer test");

    expect(response.status).toBe(200);
    expect(state.uploadFile).toHaveBeenCalled();
    expect(state.uploadFile.mock.calls[0][0]).not.toBe(
      "documents/u1/doc-1/source.docx",
    );
    expect(state.inserts).toContainEqual({
      table: "document_versions",
      payload: expect.objectContaining({
        source: "user_accept",
        processing_state: "pending_scan",
        content_sha256: "hash-resolved",
      }),
    });
    expect(state.updates).toContainEqual({
      table: "document_versions",
      payload: { processing_state: "ready" },
    });
    expect(response.body.version_id).toBe("v2");
  });

  it("does not store or advance when the resolved bytes fail scanning", async () => {
    state.scanVersionContent.mockResolvedValue({
      scan: { status: "quarantined", provider: "test", detail: "rejected" },
      processingState: "quarantined",
      trusted: false,
    });

    const response = await request(app)
      .post("/single-documents/doc-1/edits/edit-1/reject")
      .set("Authorization", "Bearer test");

    expect(response.status).toBe(422);
    expect(state.uploadFile).not.toHaveBeenCalled();
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("does not replace a newer active version when the optimistic pointer update loses", async () => {
    state.pointerSucceeds = false;

    const response = await request(app)
      .post("/single-documents/doc-1/edits/edit-1/accept")
      .set("Authorization", "Bearer test");

    expect(response.status).toBe(409);
    expect(state.deleteFile).toHaveBeenCalled();
    expect(state.updates).toContainEqual({
      table: "documents",
      payload: { current_version_id: "v2" },
    });
  });
});
