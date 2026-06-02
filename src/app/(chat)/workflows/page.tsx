"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Check, ChevronDown, Copy, Edit3, Eye, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import useChatStore from "@/app/hooks/useChatStore";
import type { AttachedWorkflow, CustomWorkflow } from "@/app/hooks/useChatStore";
import { safeStorage } from "@/lib/safe-storage";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowRow | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.6); // 60% list / 40% prompt
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const deleteCustomWorkflow = useChatStore((state) => state.deleteCustomWorkflow);
  const updateCustomWorkflow = useChatStore((state) => state.updateCustomWorkflow);
  const router = useRouter();

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.75, Math.max(0.4, ratio)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);
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

      router.push("/");
    });
  };

  return (
    <main ref={containerRef} className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <section className="flex min-w-0 flex-col" style={{ width: selected ? `${splitRatio * 100}%` : "100%" }} onClick={() => {/* close any open menus via document click */}}>
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
              <div
                key={workflow.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(workflow)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(workflow); }}
                className={`grid w-full cursor-pointer grid-cols-[360px_220px_160px_40px] items-center border-b border-[var(--border)] px-8 py-[14px] text-left transition-colors hover:bg-[var(--bg-tertiary)] ${
                  selected?.id === workflow.id ? "bg-[var(--sidebar-bg)]" : ""
                }`}
              >
                <div className="text-[14px] font-medium text-[var(--text)]">{workflow.title}</div>
                <div className="text-[13px] text-[var(--text-muted)]">{workflow.practice}</div>
                <div className="text-[13px] text-[var(--text-muted)]">
                  {workflow.source}
                </div>
                <WorkflowMenu
                  workflow={workflow}
                  onView={() => setSelected(workflow)}
                  onEdit={() => setEditingWorkflow(workflow)}
                  onDuplicate={() => {
                    const saved = addCustomWorkflow({ title: `Copy of ${workflow.title}`, prompt: workflow.prompt, requireDocumentUpload: workflow.requireDocumentUpload });
                    setSelected({ ...saved, practice: "Custom", source: "Custom" });
                    setActiveTab("custom");
                  }}
                  onDelete={() => setConfirmDeleteId(workflow.id)}
                />
              </div>
            ))
          )}
        </div>
      </section>

      {selected && (
        <>
        {/* Draggable divider */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-[var(--border)] transition-colors hover:bg-[var(--text-faint)]"
        >
          <div className="h-8 w-0.5 rounded-full bg-[var(--text-faint)]" />
        </div>
        <aside className="flex shrink-0 flex-col bg-[var(--sidebar-bg)]" style={{ width: `${(1 - splitRatio) * 100}%`, minWidth: "25%" }}>
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
        </>
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-[380px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_8px_32px_var(--shadow-modal)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-[var(--text)]">Delete Workflow</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Are you sure you want to delete this workflow? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCustomWorkflow(confirmDeleteId);
                  if (selected?.id === confirmDeleteId) setSelected(null);
                  setConfirmDeleteId(null);
                }}
                className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
      {editingWorkflow && editingWorkflow.source === "Custom" && (
        <EditWorkflowModal
          workflow={editingWorkflow}
          onClose={() => setEditingWorkflow(null)}
          onSave={(updates) => {
            updateCustomWorkflow(editingWorkflow.id, updates);
            if (selected?.id === editingWorkflow.id) {
              setSelected({ ...editingWorkflow, ...updates });
            }
            setEditingWorkflow(null);
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

function EditWorkflowModal({
  workflow,
  onClose,
  onSave,
}: {
  workflow: WorkflowRow;
  onClose: () => void;
  onSave: (updates: { title: string; prompt: string; requireDocumentUpload?: boolean }) => void;
}) {
  const [name, setName] = useState(workflow.title);
  const [instructions, setInstructions] = useState(workflow.prompt);
  const [requireDocumentUpload, setRequireDocumentUpload] = useState(workflow.requireDocumentUpload ?? false);

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
        <h2 className="text-[28px] font-normal">Edit Workflow</h2>
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

function WorkflowMenu({
  workflow,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  workflow: WorkflowRow;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isBuiltIn = workflow.source === "Vaultr";

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="text-[var(--text-faint)] hover:text-[var(--text-muted)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); onView(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          {!isBuiltIn && (
            <>
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onDuplicate(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--danger-bg)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
