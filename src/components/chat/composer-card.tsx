"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { ArrowRight, Brain, Check, Cloud, File, FileText, FolderOpen, Globe, Library, Lock, Square, X } from "lucide-react";
import { ModelSelector } from "@/components/chat/model-selector";
import { WorkflowsModal } from "@/components/workflows/workflows-modal";
import { AddDocButton } from "@/components/chat/add-doc-button";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import { formatBytes, type LocalDocument } from "@/lib/local-documents";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import useChatStore, { type AttachedWorkflow } from "@/app/hooks/useChatStore";
import { GROQ_DEFAULT_MODEL, isLexModel, isThinkingCapableModel, sortModelsByLexOrder } from "@/lib/models";

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

function decodeBase64Text(base64: string) {
  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes).trim();
}

function extractClientDocumentText(doc: LocalDocument) {
  const fileType = doc.fileType?.toLowerCase();
  const filename = doc.filename.toLowerCase();
  if (fileType !== "txt" && fileType !== "md" && !filename.endsWith(".txt") && !filename.endsWith(".md")) {
    return "";
  }

  const base64 = doc.content || doc.dataUrl?.split(",")[1] || "";
  if (!base64) return "";
  return decodeBase64Text(base64);
}

export function ComposerCard({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  setInput,
  modelSelectorDirection = "up",
}: ComposerCardProps) {
  const safeInput = typeof input === "string" ? input : "";
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [attachedDocuments, setAttachedDocuments] = React.useState<LocalDocument[]>([]);
  const [docSelectorOpen, setDocSelectorOpen] = React.useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<AttachedWorkflow | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const pendingAttachedDocumentIds = useChatStore((state) => state.pendingAttachedDocumentIds);
  const setPendingAttachedDocumentIds = useChatStore((state) => state.setPendingAttachedDocumentIds);
  const pendingWorkflow = useChatStore((state) => state.pendingWorkflow);
  const setPendingWorkflow = useChatStore((state) => state.setPendingWorkflow);
  const composerResetToken = useChatStore((state) => state.composerResetToken);
  const thinkingModeDefault = useChatStore((state) => state.thinkingModeDefault);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const setCloudMode = useChatStore((state) => state.setCloudMode);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const savedWebSearch = window.localStorage.getItem("vaultr-web-search-default");
    const savedThinking = window.localStorage.getItem("vaultr-thinking-enabled");
    setWebSearchEnabled(savedWebSearch === "true");
    setThinkingEnabled(savedThinking === null ? thinkingModeDefault : savedThinking === "true");
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
    if (setInput) setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [composerResetToken, setInput]);

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
      const currentDoc = useLocalVaultStore
        .getState()
        .documents.find((item) => item.id === doc.id);
      return [...current, currentDoc || doc];
    });
  }, []);

  const handleAddDocuments = React.useCallback((docs: LocalDocument[]) => {
    setAttachedDocuments((current) => {
      const existing = new Set(current.map((doc) => doc.id));
      return [...current, ...docs.filter((doc) => !existing.has(doc.id))];
    });
  }, []);

  const waitForDocumentContent = async (docs: LocalDocument[]) => {
    if (docs.length === 0) return docs;

    const docIds = docs.map((doc) => doc.id);
    const startedAt = Date.now();

    while (Date.now() - startedAt < 3000) {
      const latestDocuments = useLocalVaultStore.getState().documents;
      const resolvedDocuments = docIds
        .map((docId) => latestDocuments.find((item) => item.id === docId))
        .filter((doc): doc is LocalDocument => Boolean(doc));

      if (
        resolvedDocuments.length === docs.length &&
        resolvedDocuments.every((doc) => Boolean(doc.content || doc.dataUrl))
      ) {
        return resolvedDocuments;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    const latestDocuments = useLocalVaultStore.getState().documents;
    return docs.map((doc) => latestDocuments.find((item) => item.id === doc.id) || doc);
  };

  const submitWithReset = async (
    event: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    event.preventDefault();
    const documentsWithContent = await waitForDocumentContent(attachedDocuments);
    const documentsWithExtractedText = documentsWithContent.map((doc) => {
      const extractedText = extractClientDocumentText(doc);
      if (extractedText) {
        console.log("📄 DOCUMENT CONTENT:", extractedText.substring(0, 200));
      }
      return {
        ...doc,
        extractedText,
      };
    });
    const metadata = {
      workflow: selectedWorkflow,
      attachedDocuments: documentsWithExtractedText.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        sizeBytes: doc.sizeBytes,
        extractedText: doc.extractedText || undefined,
        content: doc.content,
        dataUrl: doc.dataUrl,
      })),
      webSearch: webSearchEnabled,
      thinking: usePrivacyMode && thinkingEnabled && isThinkingCapableModel(selectedModel),
      usePrivacyMode,
    };

    handleSubmit(event, {
      ...options,
      body: {
        ...options?.body,
        ...metadata,
        ollamaUrl,
      },
    });
    if (safeInput.trim() || attachedDocuments.length > 0) {
      setSelectedWorkflow(null);
    }
  };

  const useWorkflowPrompt = (workflow: AttachedWorkflow) => {
    setSelectedWorkflow(workflow);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const setPersistentWebSearch = () => {
    setWebSearchEnabled((enabled) => {
      window.localStorage.setItem("vaultr-web-search-default", String(!enabled));
      return !enabled;
    });
  };

  const setPersistentThinking = () => {
    setThinkingEnabled((enabled) => {
      window.localStorage.setItem("vaultr-thinking-enabled", String(!enabled));
      return !enabled;
    });
  };

  const switchMode = async () => {
    if (!cloudMode) {
      setCloudMode(true, GROQ_DEFAULT_MODEL);
      return;
    }

    let privateModel = isLexModel(selectedModel) ? selectedModel : null;
    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const modelIds = Array.isArray(data?.models)
          ? data.models.map(({ name }: { name: string }) => name)
          : [];
        privateModel = sortModelsByLexOrder(modelIds.filter(isLexModel))[0] || privateModel;
      }
    } catch {
      privateModel = privateModel || null;
    }
    setCloudMode(false, privateModel);
  };

  const usePrivacyMode = !cloudMode;
  const thinkingSupported = usePrivacyMode && isThinkingCapableModel(selectedModel);

  return (
    <>
      <form onSubmit={submitWithReset} className="w-full" style={{ maxWidth: "780px" }}>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] md:rounded-[20px]">
          {(selectedWorkflow || attachedDocuments.length > 0) && (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              {selectedWorkflow && (
                <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--white)]/20 bg-[var(--blue)] py-0.5 pl-2.5 pr-1 text-xs text-[var(--white)] shadow backdrop-blur-sm">
                  <Library className="h-2.5 w-2.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{selectedWorkflow.title}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflow(null)}
                    className="ml-0.5 rounded-full p-0.5 text-[var(--white)]/60 transition-colors hover:bg-[var(--bg)]/20 hover:text-[var(--white)]"
                    aria-label="Remove workflow"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              {attachedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--white)]/20 bg-[var(--accent)] py-0.5 pl-2 pr-1 text-xs text-[var(--white)] shadow backdrop-blur-sm"
                >
                  {doc.fileType === "pdf" ? (
                    <FileText className="h-2.5 w-2.5 shrink-0 text-[var(--danger)]" />
                  ) : (
                    <File className="h-2.5 w-2.5 shrink-0 text-[var(--blue)]" />
                  )}
                  <span className="max-w-[140px] truncate">{doc.filename}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedDocuments((current) =>
                        current.filter((item) => item.id !== doc.id)
                      )
                    }
                    className="ml-0.5 rounded-full p-0.5 text-[var(--white)]/60 transition-colors hover:bg-[var(--bg)]/20 hover:text-[var(--white)]"
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
              value={safeInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              name="message"
              placeholder="Ask Lex a legal question..."
              minRows={1}
              maxRows={8}
              className="max-h-48 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:outline-none"
              style={{ lineHeight: 1.5, verticalAlign: "top" }}
            />
          </div>

          <div className="flex items-center justify-between p-2 md:p-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={switchMode}
                aria-pressed={cloudMode}
                title={cloudMode ? "Switch to Private Mode" : "Switch to Cloud Mode"}
                className="mr-1 flex h-8 items-center gap-2 rounded-lg px-2 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <span className={`hidden items-center gap-1 sm:flex ${cloudMode ? "text-[var(--text-faint)]" : "text-[var(--text)]"}`}>
                  <Lock className="h-3.5 w-3.5" />
                  Private
                </span>
                <span
                  className={`flex h-5 w-10 items-center rounded-full p-0.5 transition-colors ${
                    cloudMode ? "bg-[#378ADD]" : "bg-[#3B6D11]"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      cloudMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
                <span className={`hidden items-center gap-1 sm:flex ${cloudMode ? "text-[var(--text)]" : "text-[var(--text-faint)]"}`}>
                  <Cloud className="h-3.5 w-3.5" />
                  Cloud
                </span>
              </button>
              <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />
              <AddDocButton
                onSelectDoc={handleAddDocument}
                onBrowseAll={() => setDocSelectorOpen(true)}
                selectedDocIds={attachedDocuments.map((doc) => doc.id)}
              />
              <button
                type="button"
                className={toolbarButtonClass}
                onClick={() => setDocSelectorOpen(true)}
                aria-label="Open vault"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vault</span>
              </button>
              <button
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors ${
                  selectedWorkflow
                    ? "text-[var(--blue)] hover:bg-[var(--bg-tertiary)]"
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
                onClick={setPersistentWebSearch}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                  webSearchEnabled
                    ? "text-[var(--blue)]"
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
                    setPersistentThinking();
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                  thinkingEnabled && thinkingSupported
                    ? "text-[var(--purple)]"
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
                className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--bg-primary)] transition-all duration-150 active:enabled:scale-95 disabled:cursor-default disabled:bg-[var(--border)] disabled:text-[var(--text-faint)]"
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
        breadcrumb={["Lex", "Select from Vault"]}
        title="Select from Vault"
        describeDocument={(doc) => {
          const project = projects.find((item) => item.id === doc.projectId);
          return `${project?.name || "Vault"} · ${formatBytes(doc.sizeBytes)}`;
        }}
      />
      <WorkflowsModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        onUse={useWorkflowPrompt}
      />
    </>
  );
}
