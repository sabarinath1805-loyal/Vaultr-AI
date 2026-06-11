/**
 * Supabase client for Vaultr AI — beta user management, rate limiting, and usage logging.
 *
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon/public key (browser-safe)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (server-side only, bypasses RLS)
 *
 * PII handling:
 * - Browser session persistence is OFF by default. Set
 *   NEXT_PUBLIC_SUPABASE_PERSIST_SESSION=true to opt back in (NOT recommended
 *   for legal deployments — chat content in IndexedDB is unencrypted at rest).
 * - logUsage() masks the client IP to /24 (v4) / /48 (v6) before storage.
 * - usage_logs rows have a 90-day retention policy (see migration 002).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PERSIST_SESSION =
  process.env.NEXT_PUBLIC_SUPABASE_PERSIST_SESSION === "true";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ---------- Browser client (uses anon key, respects RLS) ----------

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // PII: client sessions in localStorage is a risk for legal deployments.
      persistSession: PERSIST_SESSION,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return browserClient;
}

// ---------- Server client (uses service role key, bypasses RLS) ----------

let serverClient: SupabaseClient | null = null;

export function createServerSupabaseClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !serviceKey) return null;
  if (serverClient) return serverClient;
  serverClient = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}

// ---------- IP masking (PII) ----------

/**
 * Mask a client IP to a /24 (IPv4) or /48 (IPv6) prefix. The host bits are
 * zeroed, which is sufficient for fraud/abuse analytics but does not
 * constitute personal data under most PDPA / GDPR readings.
 *
 * `null` and unknown-shape inputs return `null` (we don't store the IP at
 * all in that case).
 */
export function maskIpAddress(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;

  // IPv4 — zero the last octet
  const v4 = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(trimmed);
  if (v4) return `${v4[1]}.0`;

  // IPv6 — keep the first 48 bits, zero the rest
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    // Pad to 8 hextets
    const head = parts.slice(0, 3).join(":");
    return `${head}::`;
  }

  return null;
}

// ---------- Beta user check ----------

export async function isBetaUser(email: string): Promise<boolean> {
  const client = createServerSupabaseClient();
  if (!client) return true; // dev fallback
  const { data, error } = await client
    .from("beta_users")
    .select("approved")
    .eq("email", email.toLowerCase().trim())
    .single();
  if (error || !data) return false;
  return data.approved === true;
}

// ---------- Usage logging (PII-scrubbing) ----------

/**
 * Insert a row into `usage_logs`. IPs are masked to /24 (v4) / /48 (v6) before
 * storage. Rows are subject to a 90-day retention cron — see
 * supabase/migrations/002_data_lifecycle.sql.
 */
export async function logUsage(
  userId: string,
  model: string,
  ip: string,
  responseTimeMs?: number,
  jurisdiction?: string
): Promise<void> {
  const client = createServerSupabaseClient();
  if (!client) return;
  const maskedIp = maskIpAddress(ip);
  await client.from("usage_logs").insert({
    user_id: userId,
    model,
    ip_address: maskedIp,
    response_time_ms: responseTimeMs ?? null,
    jurisdiction: jurisdiction ?? null,
  });
}

// ---------- Rate limiting (Supabase-backed) ----------

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetsAt: string | null;
}

export async function checkSupabaseRateLimit(
  userId: string,
  model: string,
  limit: number
): Promise<RateLimitResult> {
  const client = createServerSupabaseClient();
  if (!client) return { allowed: true, count: 0, limit, resetsAt: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString();

  const { data: existing } = await client
    .from("rate_limits")
    .select("id, count, reset_at")
    .eq("user_id", userId)
    .eq("model", model)
    .gte("reset_at", todayStr)
    .single();

  if (existing) {
    if (existing.count >= limit) {
      return { allowed: false, count: existing.count, limit, resetsAt: existing.reset_at };
    }
    await client
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("id", existing.id);
    return { allowed: true, count: existing.count + 1, limit, resetsAt: existing.reset_at };
  }

  await client.from("rate_limits").insert({
    user_id: userId,
    model,
    count: 1,
    reset_at: tomorrowStr,
  });
  return { allowed: true, count: 1, limit, resetsAt: tomorrowStr };
}

// ---------- Auth helpers ----------

export async function getSessionUser(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const client = createServerSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
