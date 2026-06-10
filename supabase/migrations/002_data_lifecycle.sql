-- Vaultr AI — Data lifecycle, right-to-erasure, RLS write policies.
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query).
--
-- This migration adds:
-- 1. RLS write policies on usage_logs and rate_limits (DELETE/UPDATE blocked
--    for non-service-role; INSERT allowed only for the row owner).
-- 2. A restrictive SELECT policy on beta_users (service-role only).
-- 3. A `delete_user_data(user_id)` RPC implementing GDPR Art. 17 / PDPA
--    right-to-erasure. Service role only.
-- 4. Retention comments and a `cleanup_old_usage_logs()` helper for pg_cron.
--    90-day retention is the target.
-- 5. Cascading deletes from auth.users via the existing FK.

-- ---------- RLS write policies ----------

-- usage_logs: row owner can INSERT their own row; SELECT is unchanged.
CREATE POLICY "Users can insert own usage" ON usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Explicitly deny UPDATE/DELETE to anyone other than the service role.
-- (Service role bypasses RLS, so no policy is needed for it.)
CREATE POLICY "Deny non-service updates on usage_logs" ON usage_logs
  FOR UPDATE USING (false);

CREATE POLICY "Deny non-service deletes on usage_logs" ON usage_logs
  FOR DELETE USING (false);

-- rate_limits: same shape
CREATE POLICY "Users can insert own rate limits" ON rate_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny non-service updates on rate_limits" ON rate_limits
  FOR UPDATE USING (false);

CREATE POLICY "Deny non-service deletes on rate_limits" ON rate_limits
  FOR DELETE USING (false);

-- beta_users: this is the *whitelist*; only the service role should ever read
-- it. Replace the implicit "no policy = open" with a restrictive policy.
CREATE POLICY "Service role can view beta_users" ON beta_users
  FOR SELECT USING (false);

-- ---------- Right-to-erasure RPC ----------
-- Service-role only. Deletes every row keyed on the supplied user_id.

CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- usage_logs: ON DELETE CASCADE handles this when auth.users is deleted,
  -- but for explicit erasure we delete by id first.
  DELETE FROM usage_logs WHERE user_id = target_user_id;
  DELETE FROM rate_limits WHERE user_id = target_user_id;

  -- If a beta_users row exists for this user's email, keep it (it's the
  -- whitelist, not user data). The service-role caller can decide whether
  -- to remove that separately.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_data(UUID) TO service_role;

-- ---------- Retention helpers ----------
-- 90-day retention on usage_logs. Run via pg_cron:
--   select cron.schedule('vaultr-usage-retention', '0 3 * * *',
--                        $$ SELECT cleanup_old_usage_logs(); $$);

CREATE OR REPLACE FUNCTION cleanup_old_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM usage_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- The original migration already has a similar helper for rate_limits:
--   cleanup_expired_rate_limits()
-- Both should be registered with pg_cron in the production environment.
