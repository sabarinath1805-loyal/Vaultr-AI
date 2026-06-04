"use client";

import React, { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Login component scaffold for Supabase magic-link auth.
 * 
 * SCAFFOLD ONLY — requires Supabase credentials.
 * When configured, sends magic link to user's email for passwordless login.
 * Only approved beta users (in beta_users table) can access the app.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isSupabaseConfigured()) {
    return null; // Don't render login when Supabase isn't configured
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      // When Supabase is configured:
      // const client = createBrowserClient();
      // const { error } = await client.auth.signInWithOtp({ email });
      // if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send magic link");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] p-8 shadow-lg">
        <h1 className="mb-2 text-xl font-semibold text-[var(--text)]">Welcome to Vaultr</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Enter your email to receive a magic link for login.
        </p>

        {status === "sent" ? (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
            Check your email for the magic link. It may take a minute to arrive.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              disabled={status === "loading"}
              required
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Sending..." : "Send Magic Link"}
            </button>
            {status === "error" && (
              <p className="text-xs text-red-500">{errorMessage}</p>
            )}
          </form>
        )}

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Beta access only. Contact admin for approval.
        </p>
      </div>
    </div>
  );
}
