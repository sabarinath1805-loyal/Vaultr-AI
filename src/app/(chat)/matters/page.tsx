import { Briefcase } from "lucide-react";

export default function MattersPage() {
  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <h1 className="px-6 pb-4 pt-8 text-lg font-semibold text-[var(--text)]">
        Matters
      </h1>
      <p className="px-6 pb-6 text-[13px] text-[var(--text-muted)]">
        Manage your active legal matters and client files.
      </p>

      <div className="px-6">
        <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border)] p-12 text-center">
          <Briefcase className="h-8 w-8 text-[var(--text-faint)]" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">No matters yet</p>
          <button
            type="button"
            className="mt-4 rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-white transition-[background-color] duration-150 hover:bg-[rgb(51,51,51)]"
          >
            + New Matter
          </button>
        </div>
      </div>
    </main>
  );
}
