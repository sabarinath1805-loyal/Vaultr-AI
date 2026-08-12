import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stateHash } from "../../lib/mcp/client";

// Database-level proof for the one-time OAuth callback state. The concurrent
// calls intentionally use the same state hash; exactly one must claim it.
const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const maybeDescribe = url && serviceKey && anonKey ? describe : describe.skip;

maybeDescribe("Supabase OAuth state claim", () => {
  it("atomically returns one claim and rejects direct browser-role execution", async () => {
    const admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const password = "StackTest1!";
    const email = `oauth-claim-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Could not create OAuth claim test user");
    }
    const userId = created.data.user.id;
    const connectorId = randomUUID();
    const state = `state-${randomUUID()}`;
    const hash = stateHash(state);

    try {
      const connector = await admin.from("user_mcp_connectors").insert({
        id: connectorId,
        user_id: userId,
        name: "OAuth claim test connector",
        server_url: "https://mcp.example.test",
        auth_type: "oauth",
      });
      if (connector.error) throw connector.error;

      const inserted = await admin.from("user_mcp_oauth_states").insert({
        user_id: userId,
        connector_id: connectorId,
        state_hash: hash,
        encrypted_state_config: "encrypted",
        state_config_iv: "iv",
        state_config_tag: "tag",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
      if (inserted.error) throw inserted.error;

      const claims = await Promise.all(
        [1, 2].map(async () =>
          admin.rpc("claim_mcp_oauth_state", { p_state_hash: hash }),
        ),
      );
      const successfulClaims = claims.filter(
        (claim) => !claim.error && (claim.data ?? []).length === 1,
      );
      expect(successfulClaims).toHaveLength(1);
      expect(claims.filter((claim) => claim.error)).toHaveLength(0);

      const replay = await admin.rpc("claim_mcp_oauth_state", {
        p_state_hash: hash,
      });
      expect(replay.error).toBeNull();
      expect(replay.data ?? []).toHaveLength(0);

      const browserAttempt = await anon.rpc("claim_mcp_oauth_state", {
        p_state_hash: hash,
      });
      expect(browserAttempt.error).not.toBeNull();
    } finally {
      await admin.from("user_mcp_oauth_states").delete().eq("state_hash", hash);
      await admin.from("user_mcp_connectors").delete().eq("id", connectorId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
