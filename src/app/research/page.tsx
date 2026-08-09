import Link from "next/link";
import { IconArrowRight, IconBook2, IconMessage2 } from "@tabler/icons-react";

export default function ResearchPage() {
  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-6 py-14 md:px-10 md:py-20">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Research</p>
        <h1 className="max-w-3xl text-4xl leading-[1.05] text-[var(--text)] md:text-5xl">Research law with the evidence kept close.</h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-6 text-[var(--text-muted)]">The dedicated research workspace is being built on Vaultr&apos;s existing legal-search and citation pipeline. For now, start in Lex to use the working research flow without changing any backend behavior.</p>

        <div className="mt-12 max-w-2xl border-y border-[var(--border)] py-7">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]"><IconBook2 size={18} stroke={1.5} /></div>
            <div>
              <h2 className="text-[25px] leading-tight text-[var(--text)]">Legal research in Lex</h2>
              <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">Use the existing legal source search, citation parsing, and streaming answer flow today. The next migration stage will bring those same capabilities into this workspace with a persistent source inspector.</p>
              <Link href="/" className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text)] hover:underline">
                <IconMessage2 size={15} /> Open Lex <IconArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
