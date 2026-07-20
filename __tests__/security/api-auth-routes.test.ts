/**
 * Tests for the request-shaped behaviour of `lib/api-auth` that are NOT
 * already covered by `__tests__/security/auth.test.ts`:
 *
 *   - validateRequestSize: returns a 413 NextResponse when the body
 *     exceeds the limit, and null otherwise
 *
 * `requireAuth` exercises the full Supabase session flow and would
 * require mocking `@/lib/supabase` (and the chain of @supabase/* modules
 * that get pulled in). That surface is covered by integration tests
 * elsewhere; keep this suite focused on the pure helper.
 */

import { NextRequest } from "next/server";
import { validateRequestSize } from "@/lib/api-auth";

function makeRequest(opts: { headers?: Record<string, string>; body?: string } = {}): NextRequest {
  const headers = new Headers(opts.headers ?? {});
  // Use NextRequest's own init type rather than global RequestInit to avoid
  // a known mismatch around `signal` (Next expects undefined, not null).
  const init: { method: string; headers: Headers; body?: string } = {
    method: "POST",
    headers,
  };
  if (opts.body !== undefined) init.body = opts.body;
  return new NextRequest("http://localhost/api/x", init);
}

describe("validateRequestSize", () => {
  it("returns null when content-length is within the limit", async () => {
    const req = makeRequest({ headers: { "content-length": "100" } });
    await expect(validateRequestSize(req, 1024)).resolves.toBeNull();
  });

  it("returns a 413 NextResponse when content-length exceeds the limit", async () => {
    const req = makeRequest({ headers: { "content-length": "2048" } });
    const result = await validateRequestSize(req, 1024);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
    const body = await result!.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("falls through to body inspection when content-length is missing", async () => {
    const req = makeRequest({ body: "hello" });
    await expect(validateRequestSize(req, 1024)).resolves.toBeNull();
  });

  it("returns 413 when the actual body exceeds the limit (no content-length)", async () => {
    const req = makeRequest({ body: "x".repeat(2048) });
    const result = await validateRequestSize(req, 1024);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
  });

  it("ignores malformed content-length values", async () => {
    const req = makeRequest({ headers: { "content-length": "not-a-number" }, body: "ok" });
    await expect(validateRequestSize(req, 1024)).resolves.toBeNull();
  });

  it("respects an explicit custom limit", async () => {
    const req = makeRequest({ body: "abcdef" });
    await expect(validateRequestSize(req, 3)).resolves.toMatchObject({ status: 413 });
  });
});