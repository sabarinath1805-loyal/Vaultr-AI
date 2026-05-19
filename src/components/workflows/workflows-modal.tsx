"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Search, X } from "lucide-react";
import { BUILT_IN_WORKFLOWS } from "./builtin-workflows";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";
import useChatStore from "@/app/hooks/useChatStore";

interface WorkflowsModalProps {
  open: boolean;
  onClose: () => void;
  onUse: (workflow: AttachedWorkflow) => void;
}

export function WorkflowsModal({ open, onClose, onUse }: WorkflowsModalProps) {
  const customWorkflows = useChatStore((state) => state.customWorkflows);
  const addCustomWorkflow = useChatStore((state) => state.addCustomWorkflow);
  const builtInWorkflows: AttachedWorkflow[] = useMemo(
    () =>
      BUILT_IN_WORKFLOWS.map((workflow) => ({
        id: workflow.id,
        title: workflow.title,
        prompt: workflow.prompt || "",
      })),
    []
  );
  const allWorkflows = useMemo(
    () => [...builtInWorkflows, ...customWorkflows],
    [builtInWorkflows, customWorkflows]
  );
  const [selected, setSelected] = useState<AttachedWorkflow>(allWorkflows[0]);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [newWorkflowOpen, setNewWorkflowOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(allWorkflows[0]);
      setSearch("");
    }
  }, [allWorkflows, open]);

  if (!open || !mounted) return null;

  const filteredWorkflows = search
    ? allWorkflows.filter((workflow) =>
        workflow.title.toLowerCase().includes(search.toLowerCase())
      )
    : allWorkflows;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] w-[min(900px,calc(100vw-48px))] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>Lex</span>
            <span>›</span>
            <span>Add workflow</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewWorkflowOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--sidebar-bg)] hover:text-[var(--text)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New workflow
            </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)] hover:text-[var(--text)]"
            aria-label="Close workflows"
          >
            <X className="h-4 w-4" />
          </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="w-[280px] shrink-0 overflow-y-auto">
            <div className="px-4 pb-2 pt-3">
              <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-2.5 py-1">
                <Search className="h-3 w-3 shrink-0 text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="flex-1 bg-transparent text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                    aria-label="Clear workflow search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredWorkflows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">
                No matches found
              </p>
            ) : (
              filteredWorkflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setSelected(workflow)}
                  className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left text-xs transition-[background-color] duration-150 ${
                    selected.id === workflow.id ? "bg-[var(--sidebar-bg)]" : "hover:bg-[var(--sidebar-bg)]"
                  }`}
                >
                  <span className="flex-1 truncate text-[var(--text)]">{workflow.title}</span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {"source" in workflow && workflow.source === "custom" ? "Custom" : "Built-in"}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden border-l border-[var(--border)] px-3 pb-3">
            <div className="flex shrink-0 items-center justify-between py-3">
              <p className="text-[28px] font-normal text-[var(--text)]">Workflow Prompt</p>
            </div>
            <div className="flex-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-1 mt-4 text-[28px] font-normal text-[var(--text)] first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-1 mt-3 text-[28px] font-normal text-[var(--text)] first:mt-0">
                      {children}
                    </h2>
                  ),
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--text)]">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {selected.prompt}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-[background-color] duration-150 hover:bg-[var(--surface)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onUse({
                id: selected.id,
                title: selected.title,
                prompt: selected.prompt,
                requireDocumentUpload: selected.requireDocumentUpload,
              });
              onClose();
            }}
            className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--bg-primary)] transition-[background-color] duration-150 hover:opacity-80"
          >
            Use
          </button>
        </div>
        {newWorkflowOpen && (
          <NewWorkflowModal
            onClose={() => setNewWorkflowOpen(false)}
            onSave={(workflow) => {
              const saved = addCustomWorkflow(workflow);
              setSelected(saved);
              setNewWorkflowOpen(false);
            }}
          />
        )}
      </div>
    </div>,
    document.body
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
    <div
      className="absolute inset-0 z-[210] flex items-center justify-center bg-[var(--overlay)]"
      onClick={onClose}
    >
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--bg-primary)] hover:opacity-90"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
