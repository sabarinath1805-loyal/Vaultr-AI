"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { ArrowRight, Brain, Check, File, FileText, FolderOpen, Globe, Library, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/chat/model-selector";
import { WorkflowsModal } from "@/components/workflows/workflows-modal";
import { AddDocButton } from "@/components/chat/add-doc-button";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import type { LocalDocument } from "@/lib/local-documents";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import useChatStore, { type AttachedWorkflow } from "@/app/hooks/useChatStore";
import { isThinkingCapableModel } from "@/lib/models";

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
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<AttachedWorkflow | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);
  const documents = useLocalVaultStore((state) => state.documents);
  const pendingAttachedDocumentIds = useChatStore((state) => state.pendingAttachedDocumentIds);
  const setPendingAttachedDocumentIds = useChatStore((state) => state.setPendingAttachedDocumentIds);
  const pendingWorkflow = useChatStore((state) => state.pendingWorkflow);
  const setPendingWorkflow = useChatStore((state) => state.setPendingWorkflow);
  const composerResetToken = useChatStore((state) => state.composerResetToken);
  const thinkingModeDefault = useChatStore((state) => state.thinkingModeDefault);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const router = useRouter();

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setThinkingEnabled(thinkingModeDefault);
  }, [thinkingModeDefault]);

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
    if (!pendingWorkflow) return;
    setSelectedWorkflow(pendingWorkflow);
    setPendingWorkflow(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [pendingWorkflow, setPendingWorkflow]);

  React.useEffect(() => {
    setSelectedWorkflow(null);
    setAttachedDocuments([]);
    setWebSearchEnabled(false);
    setThinkingEnabled(thinkingModeDefault);
    if (setInput) setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [composerResetToken, setInput, thinkingModeDefault]);

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
    const metadata = {
      workflow: selectedWorkflow,
      attachedDocuments: attachedDocuments.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
      })),
      webSearch: webSearchEnabled,
      thinking: thinkingEnabled && isThinkingCapableModel(selectedModel),
    };

    handleSubmit(event, {
      ...options,
      body: {
        ...options?.body,
        ...metadata,
        serperApiKey: useChatStore.getState().serperApiKey,
        ollamaUrl,
      },
    });
    if (input.trim()) {
      setSelectedWorkflow(null);
      setAttachedDocuments([]);
      setWebSearchEnabled(false);
    }
  };

  const useWorkflowPrompt = (workflow: AttachedWorkflow) => {
    setSelectedWorkflow(workflow);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const thinkingSupported = isThinkingCapableModel(selectedModel);

  return (
    <>
      <form onSubmit={submitWithReset} className="w-[680px] max-w-[calc(100%-48px)]">
        <div className="rounded-[16px] border border-[var(--border)] bg-white md:rounded-[20px]">
          {(selectedWorkflow || attachedDocuments.length > 0) && (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              {selectedWorkflow && (
                <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-blue-600 py-0.5 pl-2.5 pr-1 text-xs text-white shadow backdrop-blur-sm">
                  <Library className="h-2.5 w-2.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{selectedWorkflow.title}</span>
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
              placeholder="Ask Lex a legal question..."
              minRows={1}
              maxRows={8}
              className="max-h-48 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:outline-none"
              style={{ lineHeight: 1.5, verticalAlign: "top" }}
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
              <button
                type="button"
                title={webSearchEnabled ? "Web search on" : "Web search off"}
                onClick={() => setWebSearchEnabled((enabled) => !enabled)}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                  webSearchEnabled
                    ? "text-[#3b82f6]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                aria-pressed={webSearchEnabled}
                aria-label="Web search"
              >
                <Globe className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={thinkingSupported ? (thinkingEnabled ? "Thinking mode on" : "Thinking mode off") : "Thinking mode requires Lex Nano, Core, Pro, Elite or Max"}
                onClick={() => {
                  if (thinkingSupported) {
                    setThinkingEnabled((enabled) => !enabled);
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                  thinkingEnabled && thinkingSupported
                    ? "text-[#8b5cf6]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                } ${thinkingSupported ? "" : "cursor-not-allowed opacity-50"}`}
                aria-pressed={thinkingEnabled && thinkingSupported}
                aria-label="Thinking mode"
              >
                <Brain className="h-4 w-4" />
              </button>
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
                className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--text)] text-white transition-all duration-150 active:enabled:scale-95 disabled:cursor-default disabled:bg-[var(--border)] disabled:text-[var(--text-faint)]"
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
