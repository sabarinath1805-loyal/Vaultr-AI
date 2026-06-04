"use client";

import React, { useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Login component for Supabase magic-link auth.
 * Sends magic link to user's email for passwordless login.
 * Only approved beta users (in beta_users table) can access the app.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isSupabaseConfigured()) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send magic link");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl">✳</span>
          <h1 className="text-xl font-semibold text-[var(--text)]">Vaultr</h1>
        </div>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Sign in to access Lex. Enter your email to receive a magic link.
        </p>

        {status === "sent" ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@firm.com"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                disabled={status === "loading"}
                required
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Sending..." : "Send Magic Link"}
            </button>
            {status === "error" && (
              <p className="text-xs text-red-500">{errorMessage}</p>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Beta access only. Contact your admin for an invitation.
        </p>
      </div>
    </div>
  );
}
