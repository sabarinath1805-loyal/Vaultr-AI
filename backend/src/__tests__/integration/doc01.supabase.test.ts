import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";

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

const PDF = Buffer.from("%PDF-1.4\nDOC-01 synthetic fixture\n%%EOF\n");

maybeDescribe("DOC-01 real version lifecycle", () => {
  const password = "Doc01Test1!";
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `doc01-${suffix}@test.local`;
  let admin: SupabaseClient;
  let userId = "";
  let token = "";
  let sourceDocumentId = "";
  let targetDocumentId = "";
  let targetVersionId = "";
  let sourcePath = "";
  let sourcePdfPath = "";

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.storage.createBucket(bucket, { public: false });
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Could not create DOC-01 test user");
    }
    userId = created.data.user.id;
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error("Could not sign in DOC-01 test user");
    }
    token = signedIn.data.session.access_token;

    const source = await admin
      .from("documents")
      .insert({ user_id: userId, status: "pending" })
      .select("id")
      .single();
    if (source.error || !source.data) throw source.error ?? new Error("source seed failed");
    sourceDocumentId = source.data.id;

    const target = await admin
      .from("documents")
      .insert({ user_id: userId, status: "pending" })
      .select("id")
      .single();
    if (target.error || !target.data) throw target.error ?? new Error("target seed failed");
    targetDocumentId = target.data.id;
  });

  afterAll(async () => {
    const paths = new Set<string>([sourcePath, sourcePdfPath].filter(Boolean));
    for (const documentId of [sourceDocumentId, targetDocumentId]) {
      if (!documentId) continue;
      const versions = await admin
        .from("document_versions")
        .select("storage_path, pdf_storage_path")
        .eq("document_id", documentId);
      for (const row of versions.data ?? []) {
        if (row.storage_path) paths.add(row.storage_path);
        if (row.pdf_storage_path) paths.add(row.pdf_storage_path);
      }
    }
    if (paths.size > 0) await admin.storage.from(bucket).remove([...paths]);
    if (sourceDocumentId) await admin.from("documents").delete().eq("id", sourceDocumentId);
    if (targetDocumentId) await admin.from("documents").delete().eq("id", targetDocumentId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("scans and promotes the direct upload version path", async () => {
    const response = await request(app)
      .post(`/single-documents/${targetDocumentId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PDF, {
        filename: "direct.pdf",
        contentType: "application/pdf",
      });
    expect(response.status).toBe(201);
    targetVersionId = response.body.id;

    const version = await admin
      .from("document_versions")
      .select("processing_state")
      .eq("id", targetVersionId)
      .single();
    expect(version.data?.processing_state).toBe("ready");
  });

  it("scans and promotes the from-document copy path", async () => {
    const sourceUpload = await request(app)
      .post(`/single-documents/${sourceDocumentId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PDF, {
        filename: "source.pdf",
        contentType: "application/pdf",
      });
    expect(sourceUpload.status).toBe(201);

    const sourceVersion = await admin
      .from("document_versions")
      .select("id, storage_path, pdf_storage_path")
      .eq("document_id", sourceDocumentId)
      .single();
    expect(sourceVersion.data).toBeTruthy();
    sourcePath = sourceVersion.data!.storage_path;
    sourcePdfPath = sourceVersion.data!.pdf_storage_path ?? "";

    const target = await request(app)
      .post(`/single-documents/${targetDocumentId}/versions/from-document`)
      .set("Authorization", `Bearer ${token}`)
      .send({ source_document_id: sourceDocumentId });
    expect(target.status).toBe(201);
    const copied = await admin
      .from("document_versions")
      .select("processing_state")
      .eq("id", target.body.id)
      .single();
    expect(copied.data?.processing_state).toBe("ready");
  });

  it("scans and promotes replacement, while pending active versions stay blocked", async () => {
    const replacement = await request(app)
      .put(`/single-documents/${targetDocumentId}/versions/${targetVersionId}/file`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PDF, {
        filename: "replacement.pdf",
        contentType: "application/pdf",
      });
    expect(replacement.status).toBe(200);

    const ready = await admin
      .from("document_versions")
      .select("processing_state")
      .eq("id", targetVersionId)
      .single();
    expect(ready.data?.processing_state).toBe("ready");

    const pending = await admin
      .from("document_versions")
      .insert({
        document_id: targetDocumentId,
        storage_path: "doc01/pending.pdf",
        filename: "pending.pdf",
        file_type: "pdf",
      })
      .select("id, processing_state")
      .single();
    expect(pending.data?.processing_state).toBe("pending_scan");
    await admin
      .from("documents")
      .update({ current_version_id: pending.data!.id })
      .eq("id", targetDocumentId);

    const blocked = await request(app)
      .get(`/single-documents/${targetDocumentId}/display`)
      .set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(404);
    expect(blocked.body.detail).toBe("No file available");
  });
});
