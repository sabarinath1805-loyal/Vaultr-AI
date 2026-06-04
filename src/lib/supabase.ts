/**
 * Supabase client scaffold for Vaultr AI.
 * 
 * SCAFFOLD ONLY — requires Supabase project credentials to function:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (server-side only)
 * 
 * Tables needed (create in Supabase dashboard):
 * - users: id (uuid), email (text), created_at (timestamp)
 * - beta_users: id (uuid), email (text), approved (boolean), created_at (timestamp)
 * - usage_logs: id (uuid), user_id (uuid), model (text), tokens_used (int), created_at (timestamp)
 * - rate_limits: id (uuid), user_id (uuid), model (text), count (int), reset_at (timestamp)
 * 
 * Auth flow:
 * 1. User enters email → magic link sent
 * 2. User clicks magic link → session created
 * 3. Check if email is in beta_users table
 * 4. If approved: allow chat access
 * 5. If not: show "waiting for approval" screen
 */

// Placeholder — install @supabase/supabase-js when ready
// import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Create a Supabase client for browser-side usage.
 * Returns null if not configured.
 */
export function createBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  // When @supabase/supabase-js is installed:
  // return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return null;
}

/**
 * Create a Supabase admin client for server-side usage.
 * Returns null if not configured.
 */
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !serviceKey) return null;
  // When @supabase/supabase-js is installed:
  // return createClient(SUPABASE_URL, serviceKey);
  return null;
}

/**
 * Check if a user email is an approved beta user.
 */
export async function isBetaUser(_email: string): Promise<boolean> {
  const client = createServerClient();
  if (!client) return true; // Allow all when Supabase not configured
  // const { data } = await client
  //   .from('beta_users')
  //   .select('approved')
  //   .eq('email', email)
  //   .single();
  // return data?.approved === true;
  return true;
}

/**
 * Log usage for a user.
 */
export async function logUsage(_userId: string, _model: string, _tokensUsed: number): Promise<void> {
  const client = createServerClient();
  if (!client) return;
  // await client.from('usage_logs').insert({
  //   user_id: userId,
  //   model,
  //   tokens_used: tokensUsed,
  // });
}
