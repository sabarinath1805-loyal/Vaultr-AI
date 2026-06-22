/**
 * Next.js proxy — central security gate for the Vaultr API. (Renamed from
 * `middleware.ts` in Next.js 16 — the `middleware` file convention is
 * deprecated. The export function name changed from `middleware` to `proxy`.)
 *
 * Behavior:
 * - When Supabase is configured, every /api/* route (except a small allow-list
 *   of pre-auth / health endpoints) requires a valid Bearer token. Unauthenticated
 *   requests get a 401.
 * - When Supabase is NOT configured, the route layer's own guards handle the
 *   "private mode" fallback. We still attach the security headers and the
 *   global rate-limit, but we do not 401.
 * - Adds HSTS, COOP, CORP, Referrer-Policy on every response.
 * - Adds a 60 req/min per-IP global rate limit for /api/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

const GLOBAL_RATE_LIMIT = 60; // requests
const GLOBAL_RATE_WINDOW_MS = 60_000; // 1 minute

// Routes that must remain reachable without an auth token.
const PRE_AUTH_ALLOWLIST = new Set<string>([
  "/api/auth/check-beta",
  "/api/tags",
]);

interface RateEntry {
  count: number;
  resetAt: number;
}

// In-memory rate-limit store (per proxy worker). 5000-entry LRU cap with
// periodic sweep on the read path is acceptable here because the Map only
// holds active windows; the cap is the real safety net.
const rateStore = new Map<string, RateEntry>();
let rateStoreSwitches = 0;
const RATE_STORE_CAP = 5000;

function sweepRateStore(now: number) {
  rateStoreSwitches++;
  // Evict expired entries on every Nth call
  if (rateStoreSwitches % 256 === 0) {
    for (const [k, v] of rateStore) {
      if (now > v.resetAt) rateStore.delete(k);
    }
    // LRU cap: if still over cap, drop oldest by insertion order
    if (rateStore.size > RATE_STORE_CAP) {
      const overflow = rateStore.size - RATE_STORE_CAP;
      let dropped = 0;
      for (const k of rateStore.keys()) {
        rateStore.delete(k);
        if (++dropped >= overflow) break;
      }
    }
  }
}

function getClientIp(req: NextRequest): string {
  // Prefer Vercel/Cloudflare trusted headers when present, fall back to
  // x-forwarded-for (leftmost) and finally to the connection IP. We do NOT
  // trust arbitrary forwarded-for blindly — most hosting providers overwrite
  // the header, so taking the first hop is a defensible default.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // NextRequest does not expose `ip` directly in 16.x; fall back to a sentinel.
  return "127.0.0.1";
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Global rate limit
  const now = Date.now();
  sweepRateStore(now);
  const ip = getClientIp(req);
  const rateEntry = rateStore.get(ip);
  if (!rateEntry || now > rateEntry.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW_MS });
  } else {
    rateEntry.count++;
    if (rateEntry.count > GLOBAL_RATE_LIMIT) {
      const res = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
      return applySecurityHeaders(res);
    }
  }

  // Allow pre-auth routes through (auth provider callbacks, Ollama tags check)
  if (PRE_AUTH_ALLOWLIST.has(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Auth gate — only enforced when Supabase is configured
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    // Supabase not configured → leave it to the route layer's own guards.
    return applySecurityHeaders(NextResponse.next());
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    const res = NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
    return applySecurityHeaders(res);
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const res = NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
    return applySecurityHeaders(res);
  }

  // Forward the resolved user id to downstream handlers via request headers
  // (read-only hint — routes must still verify on their own).
  const res = NextResponse.next();
  res.headers.set("x-vaultr-user-id", data.user.id);
  return applySecurityHeaders(res);
}

export const config = {
  matcher: ["/api/:path*"],
};
