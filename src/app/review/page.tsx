import Link from "next/link";
import { IconArrowRight, IconChartBar, IconFileSearch, IconTable } from "@tabler/icons-react";

const tools = [
  {
    href: "/contract-scanner",
    eyebrow: "Document review",
    title: "Contract Scanner",
    description: "Review an agreement for clauses, issues, evidence, and practical next actions.",
    icon: IconFileSearch,
  },
  {
    href: "/tabular-review",
    eyebrow: "Multi-document review",
    title: "Tabular Review",
    description: "Extract and compare structured findings across a document set without leaving the review workspace.",
    icon: IconTable,
  },
  {
    href: "/workflows",
    eyebrow: "Repeatable work",
    title: "Workflows",
    description: "Run saved review processes and custom legal workflows using the existing workflow engine.",
    icon: IconChartBar,
  },
];

export default function ReviewPage() {
  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-6 py-14 md:px-10 md:py-20">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Review</p>
        <h1 className="max-w-2xl text-4xl leading-[1.05] text-[var(--text)] md:text-5xl">Turn source material into reviewable legal work.</h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-6 text-[var(--text-muted)]">Choose the shape of the work. Each tool keeps its existing processing and storage behavior; Review simply gives them one coherent home.</p>

        <div className="mt-12 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {tools.map(({ href, eyebrow, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="group grid gap-5 py-7 transition-colors hover:bg-[var(--surface-elevated)] md:grid-cols-[44px_1fr_32px] md:px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]"><Icon size={18} stroke={1.5} /></div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-faint)]">{eyebrow}</div>
                <h2 className="mt-1 text-[26px] leading-tight text-[var(--text)]">{title}</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)]">{description}</p>
              </div>
              <IconArrowRight className="self-center text-[var(--text-faint)] transition-transform group-hover:translate-x-1" size={18} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
