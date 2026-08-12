import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph } from "docx";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyTrackedEdits } from "../../lib/docxTrackedChanges";
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

async function trackedDocx() {
  const base = await Packer.toBuffer(
    new Document({
      sections: [{ children: [new Paragraph("The fee is ten dollars.")] }],
    }),
  );
  const applied = await applyTrackedEdits(Buffer.from(base), [
    {
      find: "ten",
      replace: "twenty",
      context_before: "The fee is ",
      context_after: " dollars",
    },
  ]);
  if (applied.errors.length || !applied.changes[0]?.delId) {
    throw new Error("Could not create tracked DOCX fixture");
  }
  return {
    bytes: applied.bytes,
    delId: applied.changes[0].delId,
    insId: applied.changes[0].insId ?? null,
  };
}

maybeDescribe("DOC-01 Round 2 real lifecycle", () => {
  const password = "Doc01Round2!";
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `doc01-round2-${suffix}@test.local`;
  let admin: SupabaseClient;
  let userId = "";
  let token = "";
  let documentId = "";
  let reviewId = "";
  const storagePaths = new Set<string>();

  async function signIn() {
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error("Could not sign in Round 2 user");
    }
    token = signedIn.data.session.access_token;
  }

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
      throw created.error ?? new Error("Could not create Round 2 user");
    }
    userId = created.data.user.id;
    await signIn();
    const document = await admin
      .from("documents")
      .insert({ user_id: userId, status: "pending" })
      .select("id")
      .single();
    if (document.error || !document.data) {
      throw document.error ?? new Error("Could not create Round 2 document");
    }
    documentId = document.data.id;
  });

  afterAll(async () => {
    delete process.env.DOCUMENT_SCANNER_REQUIRED;
    if (documentId) {
      const versions = await admin
        .from("document_versions")
        .select("storage_path, pdf_storage_path")
        .eq("document_id", documentId);
      for (const version of versions.data ?? []) {
        if (version.storage_path) storagePaths.add(version.storage_path);
        if (version.pdf_storage_path) storagePaths.add(version.pdf_storage_path);
      }
      if (storagePaths.size) {
        await admin.storage.from(bucket).remove([...storagePaths]);
      }
      if (reviewId) await admin.from("tabular_reviews").delete().eq("id", reviewId);
      await admin.from("documents").delete().eq("id", documentId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("keeps the old trusted version immutable and promotes a scanned resolution", async () => {
    const fixture = await trackedDocx();
    const upload = await request(app)
      .post(`/single-documents/${documentId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fixture.bytes, {
        filename: "tracked.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    expect(upload.status).toBe(201);
    const original = await admin
      .from("document_versions")
      .select("id, storage_path, content_sha256, processing_state")
      .eq("document_id", documentId)
      .single();
    expect(original.data?.processing_state).toBe("ready");
    storagePaths.add(original.data!.storage_path);

    const edit = await admin
      .from("document_edits")
      .insert({
        document_id: documentId,
        version_id: original.data!.id,
        change_id: "change-round2-1",
        del_w_id: fixture.delId,
        ins_w_id: fixture.insId,
        deleted_text: "ten",
        inserted_text: "twenty",
        context_before: "The fee is ",
        context_after: " dollars",
        status: "pending",
      })
      .select("id")
      .single();
    expect(edit.error).toBeNull();

    const resolved = await request(app)
      .post(`/single-documents/${documentId}/edits/${edit.data!.id}/accept`)
      .set("Authorization", `Bearer ${token}`);
    expect(resolved.status).toBe(200);

    const versions = await admin
      .from("document_versions")
      .select("id, source, storage_path, content_sha256, processing_state")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    expect(versions.data).toHaveLength(2);
    expect(versions.data?.[0]).toMatchObject({
      id: original.data!.id,
      processing_state: "ready",
      content_sha256: original.data!.content_sha256,
    });
    expect(versions.data?.[1]).toMatchObject({
      source: "user_accept",
      processing_state: "ready",
    });
    storagePaths.add(versions.data![1].storage_path);

    const document = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    expect(document.data?.current_version_id).toBe(versions.data?.[1].id);
  });

  it("leaves the active trusted version unchanged when a resolution scan fails", async () => {
    const fixture = await trackedDocx();
    const upload = await request(app)
      .post(`/single-documents/${documentId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fixture.bytes, {
        filename: "tracked-again.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    expect(upload.status).toBe(201);
    const activeBefore = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    const versionBefore = await admin
      .from("document_versions")
      .select("id, storage_path, processing_state")
      .eq("id", activeBefore.data!.current_version_id)
      .single();
    storagePaths.add(versionBefore.data!.storage_path);

    const edit = await admin
      .from("document_edits")
      .insert({
        document_id: documentId,
        version_id: versionBefore.data!.id,
        change_id: "change-round2-2",
        del_w_id: fixture.delId,
        ins_w_id: fixture.insId,
        deleted_text: "ten",
        inserted_text: "twenty",
        status: "pending",
      })
      .select("id")
      .single();
    expect(edit.error).toBeNull();

    process.env.DOCUMENT_SCANNER_REQUIRED = "true";
    try {
      const rejected = await request(app)
        .post(`/single-documents/${documentId}/edits/${edit.data!.id}/reject`)
        .set("Authorization", `Bearer ${token}`);
      expect(rejected.status).toBe(503);
    } finally {
      delete process.env.DOCUMENT_SCANNER_REQUIRED;
    }

    const activeAfter = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    expect(activeAfter.data?.current_version_id).toBe(
      activeBefore.data?.current_version_id,
    );
    const allVersions = await admin
      .from("document_versions")
      .select("id")
      .eq("document_id", documentId);
    expect(allVersions.data?.length).toBe(3);
  });

  it("records exact Tabular provenance and blocks stale/quarantined cells", async () => {
    const active = await admin
      .from("documents")
      .select("current_version_id")
      .eq("id", documentId)
      .single();
    const sourceVersionId = active.data!.current_version_id;
    const review = await admin
      .from("tabular_reviews")
      .insert({ user_id: userId, title: "Round 2", document_ids: [documentId] })
      .select("id")
      .single();
    reviewId = review.data!.id;
    const row = await admin
      .from("tabular_review_rows")
      .insert({
        review_id: review.data!.id,
        label: "tracked-again.docx",
        row_type: "document",
        document_id: documentId,
        sort_index: 0,
      })
      .select("id")
      .single();
    await admin.from("tabular_review_row_sources").insert({
      row_id: row.data!.id,
      document_id: documentId,
    });
    const cell = await admin
      .from("tabular_cells")
      .insert({
        review_id: review.data!.id,
        row_id: row.data!.id,
        document_id: documentId,
        column_index: 0,
        content: JSON.stringify({ summary: "trusted result" }),
        status: "done",
        source_document_version_ids: [sourceVersionId],
      })
      .select("id")
      .single();
    expect(cell.error).toBeNull();

    const persisted = await admin
      .from("tabular_cells")
      .select("source_document_version_ids")
      .eq("id", cell.data!.id)
      .single();
    expect(persisted.data?.source_document_version_ids).toEqual([sourceVersionId]);

    const visible = await request(app)
      .get(`/tabular-review/${review.data!.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(visible.status).toBe(200);
    expect(visible.body.cells[0].content).toMatchObject({
      summary: "trusted result",
    });

    await admin
      .from("document_versions")
      .update({ processing_state: "quarantined" })
      .eq("id", sourceVersionId);
    const quarantined = await request(app)
      .get(`/tabular-review/${review.data!.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(quarantined.status).toBe(200);
    expect(quarantined.body.cells[0]).toMatchObject({
      content: null,
      provenance_status: "quarantined",
    });
  });
});
