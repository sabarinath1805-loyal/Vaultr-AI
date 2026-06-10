/**
 * Supabase client for Vaultr AI — beta user management, rate limiting, and usage logging.
 *
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon/public key (browser-safe)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (server-side only, bypasses RLS)
 *
 * Tables (see supabase/migrations/001_initial_schema.sql):
 * - beta_users: email whitelist for approved beta testers
 * - usage_logs: per-request logging (user, model, timestamp)
 * - rate_limits: daily request counts per user per model
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Check whether the Supabase project URL and anon key are both configured via environment variables.
 *
 * @returns `true` if both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, `false` otherwise.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ---------- Browser client (uses anon key, respects RLS) ----------

let browserClient: SupabaseClient | null = null;

/**
 * Create a Supabase client for browser use (respects RLS). Uses the anon key and is safe to expose in client-side bundles.
 *
 * @returns A `SupabaseClient` instance, or `null` if Supabase is not configured.
 */
export function createBrowserSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

// ---------- Server client (uses service role key, bypasses RLS) ----------

let serverClient: SupabaseClient | null = null;

/**
 * Create a Supabase client for server-side use (bypasses RLS). Requires the service role key (not safe for client bundles).
 *
 * @returns A `SupabaseClient` instance with elevated permissions, or `null` if Supabase is not configured with a service key.
 */
export function createServerSupabaseClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !serviceKey) return null;
  if (serverClient) return serverClient;
  serverClient = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}

// ---------- Beta user check ----------

/**
 * Check whether a given email is on the approved beta-users list in Supabase.
 *
 * @param email - The email to check. Case-insensitive.
 * @returns `true` if the email is found and `approved = true`. Returns `true` for all emails when Supabase is not configured (local-dev fallback). Returns `false` if the lookup fails or the user is not approved.
 */
export async function isBetaUser(email: string): Promise<boolean> {
  const client = createServerSupabaseClient();
  if (!client) return true; // Allow all when Supabase not configured
  const { data, error } = await client
    .from("beta_users")
    .select("approved")
    .eq("email", email.toLowerCase().trim())
    .single();
  if (error || !data) return false;
  return data.approved === true;
}

// ---------- Usage logging ----------

/**
 * Insert a row into the `usage_logs` table for audit / analytics. Silent no-op if Supabase is not configured.
 *
 * @param userId - The Supabase user id (or "anonymous" for local dev).
 * @param model - The model id used (e.g. "claude-opus-4-6").
 * @param ip - The originating client IP (used for fraud / abuse analysis).
 * @param responseTimeMs - Optional response time in milliseconds.
 * @param jurisdiction - Optional jurisdiction string (e.g. "sg", "uk", "us").
 * @returns Resolves once the row is inserted (or immediately if Supabase is unconfigured).
 */
export async function logUsage(userId: string, model: string, ip: string, responseTimeMs?: number, jurisdiction?: string): Promise<void> {
  const client = createServerSupabaseClient();
  if (!client) return;
  await client.from("usage_logs").insert({
    user_id: userId,
    model,
    ip_address: ip,
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

  // Get or create today's rate limit entry
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
    // Increment count
    await client
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("id", existing.id);
    return { allowed: true, count: existing.count + 1, limit, resetsAt: existing.reset_at };
  }

  // Create new entry for today
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
