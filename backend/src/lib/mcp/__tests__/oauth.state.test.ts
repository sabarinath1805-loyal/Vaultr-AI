import { afterEach, describe, expect, it, vi } from "vitest";
import {
  oauthClientEnvFor,
  validateOAuthStateConfig,
  validateOAuthStateRecord,
} from "../oauth";
import { stateHash } from "../client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MCP OAuth state contracts", () => {
  it("rejects replayed, expired, wrong-state, and wrong-user callbacks", () => {
    const state = "signed-state";
    const row = {
      state_hash: stateHash(state),
      expires_at: "2026-08-10T00:10:00.000Z",
      user_id: "user-a",
    };
    const now = Date.parse("2026-08-10T00:00:00.000Z");
    expect(validateOAuthStateRecord(row, state, "user-a", now)).toBe(true);
    expect(validateOAuthStateRecord(row, state, "user-b", now)).toBe(false);
    expect(validateOAuthStateRecord(row, "other-state", "user-a", now)).toBe(false);
    expect(
      validateOAuthStateRecord(row, state, "user-a", Date.parse("2026-08-10T00:10:00.000Z")),
    ).toBe(false);
  });

  it("requires a usable redirect URI and rejects an incomplete state config", () => {
    expect(() => validateOAuthStateConfig({ codeVerifier: "v", redirectUri: "" })).toThrow(/incomplete/);
    expect(() => validateOAuthStateConfig({ codeVerifier: "v", redirectUri: "https://user:pass@example.com/callback" })).toThrow(/invalid/);
    expect(() => validateOAuthStateConfig({ codeVerifier: "v", redirectUri: "http://evil.example.com/callback" })).toThrow(/HTTPS/);
    expect(validateOAuthStateConfig({ codeVerifier: "v", redirectUri: "http://localhost:3001/callback" }).redirectUri).toContain("localhost");
  });

  it("does not invent OAuth client credentials when configuration is absent", () => {
    vi.stubEnv("MCP_OAUTH_CLIENT_ID", "");
    vi.stubEnv("MCP_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("MCP_OAUTH_DEFAULT_SCOPE", "");
    expect(oauthClientEnvFor("https://mcp.example.com")).toEqual({
      clientId: undefined,
      clientSecret: undefined,
      scope: undefined,
    });
  });
});
