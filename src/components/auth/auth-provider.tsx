"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { LoginForm } from "./login";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider wraps the app. When Supabase is configured:
 * - Shows LoginForm if no session
 * - Shows "waiting for approval" if not a beta user
 * - Shows children if authenticated + approved
 * 
 * When Supabase is NOT configured, children render immediately (dev mode).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaApproved, setBetaApproved] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        checkBetaStatus(s.user.email);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.email) {
          checkBetaStatus(s.user.email);
        } else {
          setBetaApproved(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkBetaStatus(email: string) {
    try {
      const res = await fetch("/api/auth/check-beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setBetaApproved(data.approved === true);
    } catch {
      setBetaApproved(true); // Allow if check fails
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setBetaApproved(null);
  };

  // When Supabase is not configured, skip auth entirely
  if (!isSupabaseConfigured()) {
    return (
      <AuthContext.Provider value={{ user: null, session: null, loading: false, signOut }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!user) {
    return <LoginForm />;
  }

  // Authenticated but not approved — show waiting screen
  if (betaApproved === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] p-8 text-center shadow-lg">
          <span className="text-3xl">✳</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text)]">Waiting for Approval</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Your account ({user.email}) is pending beta approval. You&apos;ll receive an email once approved.
          </p>
          <button
            onClick={signOut}
            className="mt-6 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
