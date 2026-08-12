import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph } from "docx";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { runEditDocument } from "../../lib/chat/tools/documentOps";
import { contentSha256 } from "../../lib/documentVersions";
import { createServerSupabase } from "../../lib/supabase";
import { downloadFile } from "../../lib/storage";

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const bucket = process.env.R2_BUCKET_NAME ?? "mike";
const enabled =
  process.env.SUPABASE_TEST_REAL_HTTP === "1" &&
  !!url &&
  !!serviceKey &&
  !!anonKey &&
  !!process.env.R2_ENDPOINT_URL;
const maybeDescribe = enabled ? describe : describe.skip;

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type VersionSnapshot = {
  id: string;
  source: string;
  storage_path: string;
  content_sha256: string | null;
  processing_state: string;
  version_number: number | null;
  bytes: Buffer;
};

async function fixtureDocx(): Promise<Buffer> {
  return Packer.toBuffer(
    new Document({
      sections: [{ children: [new Paragraph("The fee is ten dollars.")] }],
    }),
  ).then((bytes) => Buffer.from(bytes));
}

maybeDescribe("DOC-01 immutable edit reuse race", () => {
  const password = "Doc01Reuse1!";
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `doc01-reuse-${suffix}@test.local`;
  let admin: SupabaseClient;
  let db: ReturnType<typeof createServerSupabase>;
  let userId = "";
  let token = "";
  const documentIds = new Set<string>();

  async function createUploadedDocument(filename: string) {
    const document = await admin
      .from("documents")
      .insert({ user_id: userId, status: "pending" })
      .select("id")
      .single();
    if (document.error || !document.data) {
      throw document.error ?? new Error("Could not create reuse-race document");
    }
    const documentId = document.data.id as string;
    documentIds.add(documentId);
    const upload = await request(app)
      .post(`/single-documents/${documentId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", await fixtureDocx(), {
        filename,
        contentType: DOCX_CONTENT_TYPE,
      });
    expect(upload.status).toBe(201);

    const original = await snapshotVersion(documentId, null);
    return { documentId, original };
  }

  async function snapshotVersion(
    documentId: string,
    versionId: string | null,
  ): Promise<VersionSnapshot> {
    let query = admin
      .from("document_versions")
      .select(
        "id, source, storage_path, content_sha256, processing_state, version_number",
      )
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    if (versionId) query = query.eq("id", versionId);
    const result = versionId ? await query.single() : await query.limit(1).single();
    if (result.error || !result.data?.storage_path) {
      throw result.error ?? new Error("Could not load version snapshot");
    }
    const raw = await downloadFile(result.data.storage_path);
    if (!raw) throw new Error("Could not download version snapshot");
    return {
      id: result.data.id,
      source: result.data.source,
      storage_path: result.data.storage_path,
      content_sha256: result.data.content_sha256,
      processing_state: result.data.processing_state,
      version_number: result.data.version_number,
      bytes: Buffer.from(raw),
    };
  }

  async function editParams(
    documentId: string,
    edits: { find: string; replace: string }[],
    reuseVersion?: VersionSnapshot,
  ) {
    return runEditDocument({
      documentId,
      userId,
      db,
      edits: edits.map((edit) => ({
        ...edit,
        context_before: "The fee is ",
        context_after: " dollars.",
      })),
      reuseVersion: reuseVersion
        ? {
            versionId: reuseVersion.id,
            versionNumber: reuseVersion.version_number ?? 1,
            storagePath: reuseVersion.storage_path,
          }
        : undefined,
    });
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    db = createServerSupabase();
    await admin.storage.createBucket(bucket, { public: false });
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Could not create reuse-race user");
    }
    userId = created.data.user.id;
    const signedIn = await createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error("Could not sign in reuse-race user");
    }
    token = signedIn.data.session.access_token;
  });

  afterAll(async () => {
    for (const documentId of documentIds) {
      const versions = await admin
        .from("document_versions")
        .select("storage_path, pdf_storage_path")
        .eq("document_id", documentId);
      const paths = (versions.data ?? []).flatMap((version) =>
        [version.storage_path, version.pdf_storage_path].filter(
          (path): path is string => !!path,
        ),
      );
      if (paths.length) await admin.storage.from(bucket).remove(paths);
      await admin.from("documents").delete().eq("id", documentId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("creates a new immutable row and object for sequential same-turn reuse", async () => {
    const { documentId, original } = await createUploadedDocument(
      "sequential-reuse.docx",
    );
    const first = await editParams(documentId, [
      { find: "ten", replace: "twenty" },
    ]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const firstVersion = await snapshotVersion(documentId, first.version_id);
    const second = await editParams(
      documentId,
      [{ find: "twenty", replace: "thirty" }],
      firstVersion,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const originalAfter = await snapshotVersion(documentId, original.id);
    const firstAfter = await snapshotVersion(documentId, first.version_id);
    const secondAfter = await snapshotVersion(documentId, second.version_id);
    expect(originalAfter).toMatchObject({
      id: original.id,
      storage_path: original.storage_path,
      content_sha256: original.content_sha256,
      processing_state: "ready",
    });
    expect(originalAfter.bytes.equals(original.bytes)).toBe(true);
    expect(firstAfter.bytes.equals(firstVersion.bytes)).toBe(true);
    expect(firstAfter.storage_path).not.toBe(secondAfter.storage_path);
    expect(firstAfter.content_sha256).toBe(contentSha256(firstAfter.bytes));
    expect(secondAfter.content_sha256).toBe(contentSha256(secondAfter.bytes));

    const document = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    expect(document.data?.current_version_id).toBe(second.version_id);
  });

  it("rejects stale reuse state without mutating the old version", async () => {
    const { documentId, original } = await createUploadedDocument(
      "stale-reuse.docx",
    );
    const winner = await editParams(documentId, [
      { find: "ten", replace: "twenty" },
    ]);
    expect(winner.ok).toBe(true);
    const before = await snapshotVersion(documentId, original.id);
    const stale = await editParams(
      documentId,
      [{ find: "ten", replace: "thirty" }],
      original,
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error).toMatch(/changed|current version/i);
    const after = await snapshotVersion(documentId, original.id);
    expect(after).toMatchObject({
      storage_path: before.storage_path,
      content_sha256: before.content_sha256,
      processing_state: before.processing_state,
    });
    expect(after.bytes.equals(before.bytes)).toBe(true);
  });

  it("allows exactly one real concurrent reuse promotion and preserves the original", async () => {
    const { documentId, original } = await createUploadedDocument(
      "concurrent-reuse.docx",
    );
    const [left, right] = await Promise.all([
      editParams(documentId, [{ find: "ten", replace: "twenty" }], original),
      editParams(documentId, [{ find: "ten", replace: "thirty" }], original),
    ]);
    const results = [left, right];
    const winners = results.filter((result) => result.ok);
    const losers = results.filter((result) => !result.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(typeof (losers[0] as { error: string }).error).toBe("string");

    const originalAfter = await snapshotVersion(documentId, original.id);
    expect(originalAfter).toMatchObject({
      id: original.id,
      storage_path: original.storage_path,
      content_sha256: original.content_sha256,
      processing_state: original.processing_state,
    });
    expect(originalAfter.bytes.equals(original.bytes)).toBe(true);

    const versions = await admin
      .from("document_versions")
      .select(
        "id, source, storage_path, content_sha256, processing_state, version_number",
      )
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    expect(versions.error).toBeNull();
    expect(versions.data).toHaveLength(2);
    expect(new Set(versions.data?.map((version) => version.storage_path)).size).toBe(
      2,
    );

    const winner = winners[0] as Extract<(typeof results)[number], { ok: true }>;
    const winnerRow = versions.data?.find((version) => version.id === winner.version_id);
    expect(winnerRow).toMatchObject({
      source: "assistant_edit",
      processing_state: "ready",
    });
    const winnerBytes = await downloadFile(winnerRow!.storage_path);
    expect(winnerBytes).not.toBeNull();
    expect(contentSha256(winnerBytes!)).toBe(winnerRow!.content_sha256);
    const document = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    expect(document.data?.current_version_id).toBe(winner.version_id);
  });
});
