"use client";

import React, { useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return null;
  }

  const handleGoogleOAuth = async () => {
    setOauthLoading(true);
    setErrorMessage("");
    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      setOauthLoading(false);
      setErrorMessage(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

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
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
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
          Sign in to access Lex.
        </p>

        {status === "sent" ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleOAuth}
              disabled={oauthLoading || status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {oauthLoading ? "Signing in..." : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

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
            </form>
            {(status === "error" || errorMessage) && (
              <p className="text-xs text-red-500">{errorMessage}</p>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Beta access only. Contact your admin for an invitation.
        </p>
      </div>
    </div>
  );
}
