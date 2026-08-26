"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/app/components/site-logo";
import { useAuth } from "@/app/contexts/AuthContext";

const authGlassCardClassName =
    "vaultr-auth-card p-8 sm:p-10";
const authInputClassName =
    "vaultr-auth-input h-11 px-3.5 shadow-none";
const authToggleClassName = "vaultr-auth-switcher";
const authToggleActiveClassName = "vaultr-auth-switcher-item";
const authToggleInactiveClassName = "vaultr-auth-switcher-item";

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.push("/assistant");
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "An error occurred during login",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="vaultr-auth-canvas relative flex min-h-dvh items-start justify-center px-5 pb-12 pt-28 sm:px-6 md:pt-36">
            <div className="absolute left-1/2 top-7 -translate-x-1/2 md:top-10">
                <SiteLogo size="lg" asLink />
            </div>
            <div className="w-full max-w-[30rem]">
                {/* Login Form */}
                <div className={`${authGlassCardClassName} mb-4`}>
                    <div className="mb-8 flex items-start justify-between gap-6">
                        <div>
                            <h1 className="font-serif text-[2rem] font-medium leading-tight tracking-[-0.02em] text-[var(--vaultr-primary)]">
                                Welcome back
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--vaultr-secondary)]">
                                Continue to your legal workspace.
                            </p>
                        </div>
                        <div className={authToggleClassName}>
                            <span className={authToggleActiveClassName} data-active="true">
                                Log in
                            </span>
                            <Link
                                href="/signup"
                                className={authToggleInactiveClassName}
                            >
                                Sign up
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-[var(--vaultr-primary)]"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className={`w-full ${authInputClassName}`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-[var(--vaultr-primary)]"
                            >
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className={`w-full ${authInputClassName}`}
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="mt-2 h-11 w-full bg-[var(--vaultr-primary)] text-white shadow-[0_1px_2px_rgba(37,37,31,0.2)] hover:bg-[#38372f]"
                        >
                            {loading ? "Logging in..." : "Log in"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
