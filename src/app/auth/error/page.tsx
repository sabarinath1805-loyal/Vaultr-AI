import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] p-8 text-center shadow-lg">
        <span className="text-3xl">✳</span>
        <h2 className="mt-4 text-lg font-semibold text-[var(--text)]">Sign-in Failed</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          We couldn&apos;t complete your sign-in. Please try again.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          Return to sign in
        </Link>
      </div>
    </div>
  );
}