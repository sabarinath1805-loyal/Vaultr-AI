"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { ArrowRight, Check, File, FileText, FolderOpen, Library, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/chat/model-selector";
import { WorkflowsModal } from "@/components/workflows/workflows-modal";
import { AddDocButton } from "@/components/chat/add-doc-button";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import type { LocalDocument } from "@/lib/local-documents";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import useChatStore from "@/app/hooks/useChatStore";

interface ComposerCardProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    event: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  isLoading: boolean;
  stop: () => void;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  modelSelectorDirection?: "up" | "down";
}

const toolbarButtonClass =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)]";

export function ComposerCard({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  setInput,
  modelSelectorDirection = "up",
}: ComposerCardProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [attachedDocuments, setAttachedDocuments] = React.useState<LocalDocument[]>([]);
  const [docSelectorOpen, setDocSelectorOpen] = React.useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<string | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
  const documents = useLocalVaultStore((state) => state.documents);
  const pendingAttachedDocumentIds = useChatStore((state) => state.pendingAttachedDocumentIds);
  const setPendingAttachedDocumentIds = useChatStore((state) => state.setPendingAttachedDocumentIds);
  const pendingWorkflowTitle = useChatStore((state) => state.pendingWorkflowTitle);
  const setPendingWorkflowTitle = useChatStore((state) => state.setPendingWorkflowTitle);
  const router = useRouter();

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (pendingAttachedDocumentIds.length === 0) return;
    const pendingDocuments = documents.filter((doc) => pendingAttachedDocumentIds.includes(doc.id));
    if (pendingDocuments.length > 0) {
      setAttachedDocuments((current) => {
        const existing = new Set(current.map((doc) => doc.id));
        return [...current, ...pendingDocuments.filter((doc) => !existing.has(doc.id))];
      });
    }
    setPendingAttachedDocumentIds([]);
  }, [documents, pendingAttachedDocumentIds, setPendingAttachedDocumentIds]);

  React.useEffect(() => {
    if (!pendingWorkflowTitle) return;
    setSelectedWorkflow(pendingWorkflowTitle);
    setPendingWorkflowTitle(null);
  }, [pendingWorkflowTitle, setPendingWorkflowTitle]);

  const submitFromTextarea = () => {
    const form = textareaRef.current?.form;
    if (form) {
      form.requestSubmit();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitFromTextarea();
    }
  };

  const handleAddDocument = React.useCallback((doc: LocalDocument) => {
    setAttachedDocuments((current) => {
      if (current.some((item) => item.id === doc.id)) return current;
      return [...current, doc];
    });
  }, []);

  const handleAddDocuments = React.useCallback((docs: LocalDocument[]) => {
    setAttachedDocuments((current) => {
      const existing = new Set(current.map((doc) => doc.id));
      return [...current, ...docs.filter((doc) => !existing.has(doc.id))];
    });
  }, []);

  const submitWithReset = (
    event: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    handleSubmit(event, options);
    if (input.trim()) {
      setSelectedWorkflow(null);
      setAttachedDocuments([]);
    }
  };

  const useWorkflowPrompt = (prompt: string) => {
    if (setInput) {
      setInput(prompt);
    }
    const workflow = prompt.match(/^##\s+(.+)$/m)?.[1] ?? "Workflow";
    setSelectedWorkflow(workflow);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <>
      <form onSubmit={submitWithReset} className="w-[680px] max-w-[calc(100%-48px)]">
        <div className="rounded-[16px] border border-[var(--border)] bg-white md:rounded-[20px]">
          {(selectedWorkflow || attachedDocuments.length > 0) && (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              {selectedWorkflow && (
                <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-blue-600 py-0.5 pl-2.5 pr-1 text-xs text-white shadow backdrop-blur-sm">
                  <Library className="h-2.5 w-2.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{selectedWorkflow}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflow(null)}
                    className="ml-0.5 rounded-full p-0.5 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                    aria-label="Remove workflow"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              {attachedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black py-0.5 pl-2 pr-1 text-xs text-white shadow backdrop-blur-sm"
                >
                  {doc.fileType === "pdf" ? (
                    <FileText className="h-2.5 w-2.5 shrink-0 text-red-400" />
                  ) : (
                    <File className="h-2.5 w-2.5 shrink-0 text-blue-400" />
                  )}
                  <span className="max-w-[140px] truncate">{doc.filename}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedDocuments((current) =>
                        current.filter((item) => item.id !== doc.id)
                      )
                    }
                    className="ml-0.5 rounded-full p-0.5 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 pt-4">
            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              name="message"
              placeholder="Ask a question about your documents..."
              minRows={1}
              maxRows={8}
              className="max-h-48 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between p-2 md:p-2.5">
            <div className="flex items-center gap-1">
              <AddDocButton
                onSelectDoc={handleAddDocument}
                onBrowseAll={() => setDocSelectorOpen(true)}
                selectedDocIds={attachedDocuments.map((doc) => doc.id)}
              />
              <button
                type="button"
                className={toolbarButtonClass}
                onClick={() => router.push("/vault")}
                aria-label="Open vault"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vault</span>
              </button>
              <button
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors ${
                  selectedWorkflow
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
                }`}
                onClick={() => setWorkflowModalOpen(true)}
                aria-label="Open workflows"
              >
                {selectedWorkflow ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Library className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Workflows</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <ModelSelector disabled={isLoading} direction={modelSelectorDirection} />
              <button
                type={isLoading ? "button" : "submit"}
                onClick={(event) => {
                  if (isLoading) {
                    event.preventDefault();
                    stop();
                  }
                }}
                disabled={!isLoading && !input.trim()}
                className="relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/30 bg-gradient-to-b from-neutral-700 to-black text-white backdrop-blur-xl transition-all duration-150 active:enabled:scale-95 disabled:cursor-default disabled:from-neutral-600 disabled:to-black disabled:opacity-50"
                aria-label={isLoading ? "Stop response" : "Send message"}
              >
                {isLoading ? (
                  <Square className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      <AddDocumentsModal
        open={docSelectorOpen}
        onClose={() => setDocSelectorOpen(false)}
        onSelect={handleAddDocuments}
        breadcrumb={["Assistant", "Add Documents"]}
      />
      <WorkflowsModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        onUse={useWorkflowPrompt}
      />
    </>
  );
}
