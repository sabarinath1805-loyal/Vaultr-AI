import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";

// This is intentionally opt-in: it creates real Auth users and rows in a
// disposable Supabase stack, then exercises the production HTTP middleware.
const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const enabled = process.env.SUPABASE_TEST_REAL_HTTP === "1";
const maybeDescribe = url && serviceKey && enabled ? describe : describe.skip;

maybeDescribe("real HTTP authorization boundary", () => {
  const password = "StackTest1!";
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const emailA = `http-owner-${suffix}@test.local`;
  const emailB = `http-outsider-${suffix}@test.local`;
  const emailC = `http-shared-${suffix}@test.local`;

  let admin: SupabaseClient;
  let userA = "";
  let userB = "";
  let userC = "";
  let tokenA = "";
  let tokenB = "";
  let tokenC = "";
  let projectId = "";
  let documentId = "";

  async function createAndSignIn(email: string) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error(`Could not create ${email}`);
    }
    const client = createClient(
      url!,
      process.env.SUPABASE_TEST_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error(`Could not sign in ${email}`);
    }
    return {
      id: created.data.user.id,
      token: signedIn.data.session.access_token,
    };
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const a = await createAndSignIn(emailA);
    const b = await createAndSignIn(emailB);
    const c = await createAndSignIn(emailC);
    userA = a.id;
    userB = b.id;
    userC = c.id;
    tokenA = a.token;
    tokenB = b.token;
    tokenC = c.token;

    const project = await admin
      .from("projects")
      .insert({
        user_id: userA,
        name: `HTTP boundary ${suffix}`,
        shared_with: [emailC],
      })
      .select("id")
      .single();
    if (project.error || !project.data) {
      throw project.error ?? new Error("Could not seed shared project");
    }
    projectId = project.data.id;

    const document = await admin
      .from("documents")
      .insert({ user_id: userA, project_id: projectId })
      .select("id")
      .single();
    if (document.error || !document.data) {
      throw document.error ?? new Error("Could not seed shared document");
    }
    documentId = document.data.id;
  });

  afterAll(async () => {
    if (documentId) await admin.from("documents").delete().eq("id", documentId);
    if (projectId) await admin.from("projects").delete().eq("id", projectId);
    for (const userId of [userA, userB, userC]) {
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("allows owner and explicitly shared reader to read, but conceals it from outsider", async () => {
    const owner = await request(app)
      .get(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(owner.status).toBe(200);
    expect(owner.body.is_owner).toBe(true);

    const shared = await request(app)
      .get(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(shared.status).toBe(200);
    expect(shared.body.is_owner).toBe(false);
    expect(shared.body.documents.map((doc: { id: string }) => doc.id)).toContain(
      documentId,
    );

    const outsider = await request(app)
      .get(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(outsider.status).toBe(404);
  });

  it("keeps child reads shared-read and outsider-denied", async () => {
    const shared = await request(app)
      .get(`/projects/${projectId}/documents`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(shared.status).toBe(200);
    expect(shared.body.map((doc: { id: string }) => doc.id)).toContain(documentId);

    const outsider = await request(app)
      .get(`/projects/${projectId}/documents`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(outsider.status).toBe(404);
  });

  it("keeps project mutation owner-only and makes no ownership inference from sharing", async () => {
    const sharedPatch = await request(app)
      .patch(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ name: "must not change" });
    expect(sharedPatch.status).toBe(404);

    const sharedDelete = await request(app)
      .delete(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(sharedDelete.status).toBe(404);

    const stillThere = await admin
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();
    expect(stillThere.data?.name).toBe(`HTTP boundary ${suffix}`);
  });
});
