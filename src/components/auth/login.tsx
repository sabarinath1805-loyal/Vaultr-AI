"use client";

import React, { useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { Shield, Scale, Zap, CheckCircle } from "lucide-react";

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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

  const handleResend = () => {
    setStatus("idle");
    setErrorMessage("");
  };

  // Success state - magic link sent
  if (status === "sent") {
    return (
      <div className="flex min-h-screen">
        {/* Left panel - hidden on mobile */}
        <div className="hidden lg:flex lg:w-1/2 bg-[#0f1117] flex-col items-center justify-center p-12">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-4xl text-white filter drop-shadow-lg">✳</span>
            <span className="text-2xl font-semibold text-white">Vaultr</span>
          </div>
          <h1 className="text-3xl font-semibold text-white text-center mb-3">
            Your private legal AI.
          </h1>
          <p className="text-sm text-gray-400 text-center">
            Jurisdiction-aware. Private by default. Built for lawyers.
          </p>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-[var(--bg)] p-8">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--text)]">Check your email.</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)] text-center">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
              <button
                onClick={handleResend}
                className="mt-4 text-xs text-[var(--text-muted)] underline cursor-pointer hover:text-[var(--text)]"
              >
                Didn&apos;t get it? Resend
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen lg:rounded-2xl lg:shadow-2xl overflow-hidden">
      {/* Left panel - dark brand side */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f1117] flex-col items-center justify-between p-12">
        <div className="flex items-center gap-3">
          <span className="text-5xl text-white filter drop-shadow-lg">✳</span>
          <span className="text-2xl font-semibold text-white">Vaultr</span>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white mb-3">
            Your private legal AI.
          </h1>
          <p className="text-sm text-gray-400">
            Jurisdiction-aware. Private by default. Built for lawyers.
          </p>
        </div>

        {/* Feature cards */}
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
            <Shield className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-300">All data stays on your device</span>
          </div>
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
            <Scale className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-300">Singapore & international law</span>
          </div>
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
            <Zap className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-300">Powered by Lex, your AI counsel</span>
          </div>
        </div>
      </div>

      {/* Right panel - clean form side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-[var(--bg)] p-8">
        <div className="w-full max-w-sm px-4">
          {/* Beta badge */}
          <div className="flex justify-center">
            <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs px-3 py-1">
              Beta Access
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-semibold text-[var(--text)] text-center">
            Welcome back.
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] text-center">
            Sign in to access Lex.
          </p>

          <div className="mt-8 space-y-4">
            {/* Google OAuth button */}
            <button
              type="button"
              onClick={handleGoogleOAuth}
              disabled={oauthLoading || status === "loading"}
              className="w-full h-11 bg-white border border-[var(--border)] rounded-xl flex items-center justify-center gap-3 text-sm font-medium text-[var(--text)] hover:bg-gray-50 transition disabled:opacity-50"
            >
              {oauthLoading ? (
                <Spinner />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span>{oauthLoading ? "Signing in..." : "Continue with Google"}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            {/* Magic link form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.com"
                  className="w-full h-11 border border-[var(--border)] rounded-xl px-4 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text)]/10 disabled:opacity-50"
                  disabled={status === "loading"}
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full h-11 bg-[var(--text)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center"
              >
                {status === "loading" ? <Spinner /> : "Send Magic Link"}
              </button>
            </form>

            {/* Error message */}
            {(status === "error" || errorMessage) && (
              <p className="text-xs text-red-500 text-center mt-2">{errorMessage}</p>
            )}

            {/* Footer note */}
            <p className="mt-4 text-xs text-[var(--text-faint)] text-center">
              Beta access only. Contact your admin for an invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}