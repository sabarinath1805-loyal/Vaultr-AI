"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Search, X } from "lucide-react";
import { BUILT_IN_WORKFLOWS, type BuiltInWorkflow } from "./builtin-workflows";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";

interface WorkflowsModalProps {
  open: boolean;
  onClose: () => void;
  onUse: (workflow: AttachedWorkflow) => void;
}

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

export function WorkflowsModal({ open, onClose, onUse }: WorkflowsModalProps) {
  const [selected, setSelected] = useState<BuiltInWorkflow>(BUILT_IN_WORKFLOWS[0]);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(BUILT_IN_WORKFLOWS[0]);
      setSearch("");
    }
  }, [open]);

  if (!open || !mounted) return null;

  const filteredWorkflows = search
    ? BUILT_IN_WORKFLOWS.filter((workflow) =>
        workflow.title.toLowerCase().includes(search.toLowerCase())
      )
    : BUILT_IN_WORKFLOWS;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(0,0,0,0.3)]"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] w-[min(900px,calc(100vw-48px))] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>Assistant</span>
            <span>›</span>
            <span>Add workflow</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
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
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">Built-in</span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden border-l border-[var(--border)] px-3 pb-3">
            <div className="flex shrink-0 items-center justify-between py-3">
              <p className="text-xs font-medium text-[var(--text)]">Workflow Prompt</p>
            </div>
            <div className="flex-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-1 mt-4 text-base font-semibold text-[var(--text)] first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-1 mt-3 text-sm font-semibold text-[var(--text)] first:mt-0">
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
                {workflowPrompt(selected)}
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
                prompt: workflowPrompt(selected),
              });
              onClose();
            }}
            className="rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-1.5 text-sm font-medium text-white transition-[background-color] duration-150 hover:bg-[rgb(51,51,51)]"
          >
            Use
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
