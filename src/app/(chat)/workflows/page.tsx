"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SnowflakeIcon } from "@/components/icons/snowflake";
import useChatStore from "@/app/hooks/useChatStore";
import { BUILT_IN_WORKFLOWS, type BuiltInWorkflow, type WorkflowType } from "@/components/workflows/builtin-workflows";

type Tab = "all" | "builtin" | "custom" | "hidden";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All Workflows" },
  { id: "builtin", label: "Built-in" },
  { id: "custom", label: "Custom" },
  { id: "hidden", label: "Hidden" },
];

const typeStyles: Record<WorkflowType, string> = {
  assistant: "bg-blue-50 text-blue-700 border-blue-200",
  tabular: "bg-purple-50 text-purple-700 border-purple-200",
};

function workflowPrompt(workflow: BuiltInWorkflow) {
  if (workflow.prompt) return workflow.prompt;
  const columns = workflow.columnsConfig || [];
  return [
    `## ${workflow.title}`,
    "",
    `Review the selected documents using this ${workflow.practice} workflow.`,
    "",
    ...columns.map((column) => `### ${column.name}\n${column.prompt || ""}`),
  ].join("\n");
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WorkflowType | "">("");
  const [practiceFilter, setPracticeFilter] = useState("");
  const [selected, setSelected] = useState<BuiltInWorkflow | null>(BUILT_IN_WORKFLOWS[0]);
  const router = useRouter();
  const setPendingComposerText = useChatStore((state) => state.setPendingComposerText);
  const setPendingWorkflowTitle = useChatStore((state) => state.setPendingWorkflowTitle);

  const practices = useMemo(
    () => Array.from(new Set(BUILT_IN_WORKFLOWS.map((workflow) => workflow.practice))).sort(),
    []
  );

  const filtered = BUILT_IN_WORKFLOWS.filter((workflow) => {
    if (activeTab === "custom" || activeTab === "hidden") return false;
    if (typeFilter && workflow.type !== typeFilter) return false;
    if (practiceFilter && workflow.practice !== practiceFilter) return false;
    if (search && !workflow.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const applyWorkflow = (workflow: BuiltInWorkflow) => {
    setPendingComposerText(workflowPrompt(workflow));
    setPendingWorkflowTitle(workflow.title);
    router.push("/");
  };

  return (
    <main className="flex h-screen overflow-hidden bg-white">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-8 py-4">
          <h1 className="font-display text-2xl font-normal text-[var(--text)]">Workflows</h1>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as WorkflowType | "")}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-muted)] outline-none"
            >
              <option value="">Filter by type</option>
              <option value="assistant">Assistant</option>
              <option value="tabular">Tabular</option>
            </select>
            <select
              value={practiceFilter}
              onChange={(event) => setPracticeFilter(event.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-muted)] outline-none"
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
            <button type="button" className="rounded-[var(--radius-sm)] bg-[var(--text)] px-3 py-2 text-xs font-medium text-white hover:bg-[#333]">
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
          <div className="grid grid-cols-[40px_300px_120px_190px_160px_40px] border-b border-[var(--border)] px-8 py-2 text-xs font-medium text-[var(--text-muted)]">
            <div><input type="checkbox" aria-label="Select workflows" /></div>
            <div>Name</div>
            <div>Type</div>
            <div>Practice</div>
            <div>Source</div>
            <div />
          </div>
          {filtered.length === 0 ? (
            <div className="px-8 py-12 text-center text-sm text-[var(--text-faint)]">No workflows found</div>
          ) : (
            filtered.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelected(workflow)}
                className={`grid w-full grid-cols-[40px_300px_120px_190px_160px_40px] items-center border-b border-[var(--border)] px-8 py-3 text-left text-xs transition-colors hover:bg-[var(--sidebar-bg)] ${
                  selected?.id === workflow.id ? "bg-[var(--sidebar-bg)]" : ""
                }`}
              >
                <div><input type="checkbox" onClick={(event) => event.stopPropagation()} aria-label={`Select ${workflow.title}`} /></div>
                <div className="font-medium text-[var(--text)]">{workflow.title}</div>
                <div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${typeStyles[workflow.type]}`}>
                    {workflow.type === "assistant" ? "Assistant" : "Tabular"}
                  </span>
                </div>
                <div className="text-[var(--text-muted)]">{workflow.practice}</div>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <SnowflakeIcon size={12} />
                  Vaultr
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
            <h2 className="text-sm font-semibold text-[var(--text)]">Workflow Prompt</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{selected.title}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="prose prose-sm max-w-none rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 text-[13px] leading-relaxed text-[var(--text)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{workflowPrompt(selected)}</ReactMarkdown>
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
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#333]"
            >
              <Check className="h-3.5 w-3.5" />
              Use
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
