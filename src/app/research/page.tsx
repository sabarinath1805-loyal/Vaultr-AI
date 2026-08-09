import Link from "next/link";
import { ArrowRight, BookOpen, MessageSquare } from "lucide-react";

export default function ResearchPage() {
  return (
    <main className="h-full overflow-y-auto bg-[var(--app-background)] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-gray-900">Research</h1>
          <p className="mt-1 text-sm text-gray-500">Legal research powered by Lex and Vaultr&apos;s existing source pipeline.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 shadow-[0_-1px_6px_rgba(15,23,42,0.034),0_4px_9px_rgba(15,23,42,0.074),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl">
          <Link href="/" className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white bg-gradient-to-b from-white to-gray-100 text-gray-700 shadow-sm">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">Research with Lex</div>
              <div className="mt-0.5 text-xs leading-5 text-gray-500">Search legal sources, analyze authorities, and keep citations attached to the answer.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700" />
          </Link>
          <Link href="/history" className="group flex items-center gap-4 border-t border-gray-200/70 px-5 py-4 transition-colors hover:bg-white/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white bg-gradient-to-b from-white to-gray-100 text-gray-700 shadow-sm">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">Research history</div>
              <div className="mt-0.5 text-xs leading-5 text-gray-500">Return to previous Lex threads and research work.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700" />
          </Link>
        </div>
      </div>
    </main>
  );
}
