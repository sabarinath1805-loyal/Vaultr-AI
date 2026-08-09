import Link from "next/link";
import { ArrowRight, FileSearch, Table2, Workflow } from "lucide-react";

const tools = [
  {
    href: "/contract-scanner",
    title: "Contract Scanner",
    description: "Review one agreement for clauses, risks, supporting evidence, and next actions.",
    icon: FileSearch,
  },
  {
    href: "/tabular-review",
    title: "Tabular Review",
    description: "Compare structured findings across a set of documents in a spreadsheet-style review.",
    icon: Table2,
  },
  {
    href: "/workflows",
    title: "Workflows",
    description: "Run and manage repeatable legal review workflows.",
    icon: Workflow,
  },
];

export default function ReviewPage() {
  return (
    <main className="h-full overflow-y-auto bg-[var(--app-background)] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-gray-900">Review</h1>
            <p className="mt-1 text-sm text-gray-500">Choose a review workflow.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 shadow-[0_-1px_6px_rgba(15,23,42,0.034),0_4px_9px_rgba(15,23,42,0.074),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl">
          {tools.map(({ href, title, description, icon: Icon }, index) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/70 ${
                index > 0 ? "border-t border-gray-200/70" : ""
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white bg-gradient-to-b from-white to-gray-100 text-gray-700 shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{title}</div>
                <div className="mt-0.5 text-xs leading-5 text-gray-500">{description}</div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700" />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
