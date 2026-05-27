"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import useChatStore from "@/app/hooks/useChatStore";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";
import { BUILT_IN_WORKFLOWS } from "@/components/workflows/builtin-workflows";

type Tab = "all" | "builtin" | "custom";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All Workflows" },
  { id: "builtin", label: "Built-in" },
  { id: "custom", label: "Custom" },
];

type WorkflowRow = AttachedWorkflow & { practice: string; source: string };

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [practiceFilter, setPracticeFilter] = useState("");
  const builtInRows: WorkflowRow[] = BUILT_IN_WORKFLOWS.map((workflow) => ({
    id: workflow.id,
    title: workflow.title,
    prompt: workflow.prompt || "",
    practice: workflow.practice,
    source: "Vaultr",
  }));
  const [selected, setSelected] = useState<WorkflowRow | null>(builtInRows[0]);
  const [newWorkflowOpen, setNewWorkflowOpen] = useState(false);
  const router = useRouter();
  const setPendingWorkflow = useChatStore((state) => state.setPendingWorkflow);
  const resetComposerState = useChatStore((state) => state.resetComposerState);
  const customWorkflows = useChatStore((state) => state.customWorkflows);
  const addCustomWorkflow = useChatStore((state) => state.addCustomWorkflow);

  const practices = useMemo(
    () => Array.from(new Set(BUILT_IN_WORKFLOWS.map((workflow) => workflow.practice))).sort(),
    []
  );

  const allWorkflows: WorkflowRow[] = [
    ...builtInRows,
    ...customWorkflows.map((workflow) => ({
      ...workflow,
      practice: "Custom",
      source: "Custom",
    })),
  ];

  const filtered = allWorkflows.filter((workflow) => {
    if (activeTab === "builtin" && workflow.source === "Custom") return false;
    if (activeTab === "custom" && workflow.source !== "Custom") return false;
    if (practiceFilter && workflow.practice !== practiceFilter) return false;
    if (search && !workflow.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const applyWorkflow = (workflow: AttachedWorkflow) => {
    const nextWorkflow = {
      id: workflow.id,
      title: workflow.title,
      prompt: workflow.prompt,
      requireDocumentUpload: workflow.requireDocumentUpload,
    };
    resetComposerState();
    requestAnimationFrame(() => {
      setPendingWorkflow(nextWorkflow);
      if (typeof window !== "undefined") {
        const storedState = window.localStorage.getItem("nextjs-ollama-ui-state");
        if (storedState) {
          try {
            const parsed = JSON.parse(storedState);
            parsed.state = { ...(parsed.state || {}), pendingWorkflow: nextWorkflow };
            window.localStorage.setItem("nextjs-ollama-ui-state", JSON.stringify(parsed));
          } catch {
          }
        }
      }
      router.push("/");
    });
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-8 py-4">
          <h1 className="text-[28px] font-normal text-[var(--text)]">Workflows</h1>
          <div className="flex items-center gap-2">
            <select
              value={practiceFilter}
              onChange={(event) => setPracticeFilter(event.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)] outline-none"
            >
              <option value="">Filter by practice</option>
              {practices.map((practice) => (
                <option key={practice} value={practice}>{practice}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="w-24 bg-transparent text-xs outline-none placeholder:text-[var(--text-faint)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setNewWorkflowOpen(true)}
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--bg-primary)] hover:opacity-80"
            >
              + New workflow
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-[var(--border)] px-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-3 text-xs transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--text)] font-medium text-[var(--text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-[360px_220px_160px_40px] border-b border-[var(--border)] px-8 py-2 text-xs font-medium text-[var(--text-muted)]">
            <div>Name</div>
            <div>Practice</div>
            <div>Source</div>
            <div />
          </div>
          {filtered.length === 0 ? (
            <div className="px-8 py-12 text-center text-[28px] font-normal text-[var(--text)]">No workflows found</div>
          ) : (
            filtered.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelected(workflow)}
                className={`grid w-full grid-cols-[360px_220px_160px_40px] items-center border-b border-[var(--border)] px-8 py-[14px] text-left transition-colors hover:bg-[var(--bg-tertiary)] ${
                  selected?.id === workflow.id ? "bg-[var(--sidebar-bg)]" : ""
                }`}
              >
                <div className="text-[14px] font-medium text-[var(--text)]">{workflow.title}</div>
                <div className="text-[13px] text-[var(--text-muted)]">{workflow.practice}</div>
                <div className="text-[13px] text-[var(--text-muted)]">
                  {workflow.source}
                </div>
                <div className="text-[var(--text-faint)]"><MoreHorizontal className="h-4 w-4" /></div>
              </button>
            ))
          )}
        </div>
      </section>

      {selected && (
        <aside className="flex w-[420px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar-bg)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[28px] font-normal text-[var(--text)]">Workflow Prompt</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{selected.title}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="prose prose-sm max-w-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-6 py-5 text-sm leading-[1.7] text-[var(--text)] prose-headings:mb-2 prose-headings:text-[15px] prose-headings:font-normal prose-p:mb-3 prose-p:leading-[1.7] prose-li:mb-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.prompt}</ReactMarkdown>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => applyWorkflow(selected)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--bg-primary)] transition-colors hover:opacity-80"
            >
              <Check className="h-3.5 w-3.5" />
              Use
            </button>
          </div>
        </aside>
      )}
      {newWorkflowOpen && (
        <NewWorkflowModal
          onClose={() => setNewWorkflowOpen(false)}
          onSave={(workflow) => {
            const saved = addCustomWorkflow(workflow);
            setSelected({ ...saved, practice: "Custom", source: "Custom" });
            setActiveTab("custom");
            setNewWorkflowOpen(false);
          }}
        />
      )}
    </main>
  );
}

function NewWorkflowModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (workflow: Omit<AttachedWorkflow, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [requireDocumentUpload, setRequireDocumentUpload] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <form
        className="w-[520px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text-primary)] shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const title = name.trim();
          const prompt = instructions.trim();
          if (!title || !prompt) return;
          onSave({ title, prompt, requireDocumentUpload });
        }}
      >
        <h2 className="text-[28px] font-normal">New Workflow</h2>
        <label className="mt-5 block text-xs font-medium text-[var(--text-muted)]">
          Workflow name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          />
        </label>
        <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
          Instructions (what Lex should do)
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            className="mt-2 min-h-[160px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          />
        </label>
        <label className="mt-4 flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
          <span>Require document upload</span>
          <button
            type="button"
            onClick={() => setRequireDocumentUpload((enabled) => !enabled)}
            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${requireDocumentUpload ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]"}`}
            aria-pressed={requireDocumentUpload}
          >
            <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${requireDocumentUpload ? "translate-x-5" : ""}`} />
          </button>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
            Cancel
          </button>
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--bg-primary)] hover:opacity-90">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
