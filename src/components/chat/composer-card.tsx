"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { ArrowRight, Check, File, FileText, FolderOpen, Library, Sparkles, Square, X, Zap } from "lucide-react";
import { IconCloud, IconLock } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { ModelSelector } from "@/components/chat/model-selector";
import { WorkflowsModal } from "@/components/workflows/workflows-modal";
import { AddDocButton } from "@/components/chat/add-doc-button";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import { formatBytes, type LocalDocument } from "@/lib/local-documents";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import useChatStore, { type AttachedWorkflow } from "@/app/hooks/useChatStore";
import { ANTHROPIC_CORE_MODEL, isLexModel, isThinkingCapableModel, sortModelsByLexOrder } from "@/lib/models";
import { SourcesDropdown, SourcePills, buildJurisdictionPrompt } from "@/components/chat/sources-dropdown";


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
  agentMode?: boolean;
  onToggleAgentMode?: () => void;
}

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

async function extractServerDocumentText(doc: LocalDocument): Promise<string> {
  const fileType = doc.fileType?.toLowerCase();
  const filename = doc.filename.toLowerCase();
  const needsServerExtraction =
    fileType === "pdf" || fileType === "docx" ||
    filename.endsWith(".pdf") || filename.endsWith(".docx");
  if (!needsServerExtraction) return "";
  if (!doc.content && !doc.dataUrl) return "";

  try {
    const response = await fetch("/api/extract-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: doc.filename,
        fileType: doc.fileType,
        content: doc.content,
        dataUrl: doc.dataUrl,
      }),
    });
    if (!response.ok) return "";
    const data = await response.json();
    return typeof data.extractedText === "string" ? data.extractedText : "";
  } catch {
    return "";
  }
}

export function ComposerCard({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  setInput,
  modelSelectorDirection = "up",
  agentMode = false,
  onToggleAgentMode,
}: ComposerCardProps) {
  const safeInput = typeof input === "string" ? input : "";
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [attachedDocuments, setAttachedDocuments] = React.useState<LocalDocument[]>([]);
  const [docSelectorOpen, setDocSelectorOpen] = React.useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<AttachedWorkflow | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
  const [modePopoverOpen, setModePopoverOpen] = React.useState(false);
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);

  const modePopoverRef = React.useRef<HTMLDivElement>(null);
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const searchParams = useSearchParams();
  const pendingAttachedDocumentIds = useChatStore((state) => state.pendingAttachedDocumentIds);
  const setPendingAttachedDocumentIds = useChatStore((state) => state.setPendingAttachedDocumentIds);
  const pendingWorkflow = useChatStore((state) => state.pendingWorkflow);
  const setPendingWorkflow = useChatStore((state) => state.setPendingWorkflow);
  const composerResetToken = useChatStore((state) => state.composerResetToken);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const setCloudMode = useChatStore((state) => state.setCloudMode);
  const usePrivacyMode = !cloudMode;

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const urlParam = searchParams.get("attachDoc");
    const urlDocIds = urlParam ? urlParam.split(",").filter(Boolean) : [];
    const allPendingIds = Array.from(new Set([...pendingAttachedDocumentIds, ...urlDocIds]));
    if (allPendingIds.length === 0) return;
    if (documents.length === 0) return;
    const pendingDocuments = documents.filter((doc) => allPendingIds.includes(doc.id));
    if (pendingDocuments.length > 0) {
      setAttachedDocuments((current) => {
        const existing = new Set(current.map((doc) => doc.id));
        const nextDocuments = pendingDocuments.filter((doc) => !existing.has(doc.id));
        return nextDocuments.length > 0 ? [...current, ...nextDocuments] : current;
      });
      setPendingAttachedDocumentIds([]);
      if (urlParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete("attachDoc");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [documents, pendingAttachedDocumentIds, setPendingAttachedDocumentIds, searchParams]);

  React.useEffect(() => {
    if (!pendingWorkflow) return;
    const syncPendingWorkflow = () => {
      setSelectedWorkflow((current) =>
        current?.id === pendingWorkflow.id ? current : pendingWorkflow
      );
      textareaRef.current?.focus();
    };
    syncPendingWorkflow();
    const timer = window.setTimeout(syncPendingWorkflow, 100);
    return () => window.clearTimeout(timer);
  }, [pendingWorkflow]);

  React.useEffect(() => {
    setSelectedWorkflow((current) => (current === null ? current : null));
    setAttachedDocuments((current) => (current.length === 0 ? current : []));
    if (setInput) setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [composerResetToken, setInput]);

  React.useEffect(() => {
    if (!modePopoverOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modePopoverRef.current &&
        !modePopoverRef.current.contains(event.target as Node)
      ) {
        setModePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modePopoverOpen]);

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
    const documentsWithExtractedText = await Promise.all(
      documentsWithContent.map(async (doc) => {
        let extractedText = extractClientDocumentText(doc);
        if (!extractedText) {
          extractedText = await extractServerDocumentText(doc);
        }
        if (extractedText) {
          // Document text extracted successfully
        }
        return {
          ...doc,
          extractedText,
        };
      })
    );
    const activeWorkflow = selectedWorkflow || pendingWorkflow;
    const jurisdictionPrompt = buildJurisdictionPrompt(selectedSources);
    const metadata = {
      workflow: activeWorkflow,
      attachedDocuments: documentsWithExtractedText.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        sizeBytes: doc.sizeBytes,
        extractedText: doc.extractedText || undefined,
        content: doc.content,
        dataUrl: doc.dataUrl,
      })),
      thinking: usePrivacyMode && isThinkingCapableModel(selectedModel),
      usePrivacyMode,
      jurisdictionPrompt,
      selectedSources,
      agentMode,
    };

    handleSubmit(event, {
      ...options,
      body: {
        ...options?.body,
        ...metadata,
        ollamaUrl,
      },
    });
  };

  const useWorkflowPrompt = (workflow: AttachedWorkflow) => {
    setSelectedWorkflow(workflow);
    setPendingWorkflow(workflow);
    setWorkflowModalOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const switchMode = async () => {
    if (!cloudMode) {
      setCloudMode(true, selectedModel || ANTHROPIC_CORE_MODEL);
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

  const selectCloudMode = () => {
    if (!cloudMode) setCloudMode(true, selectedModel || ANTHROPIC_CORE_MODEL);
    setModePopoverOpen(false);
  };

  const selectPrivateMode = async () => {
    if (cloudMode) await switchMode();
    setModePopoverOpen(false);
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const removeSource = (sourceId: string) => {
    setSelectedSources((prev) => prev.filter((id) => id !== sourceId));
  };

  return (
    <>
      <form onSubmit={submitWithReset} className="w-full" style={{ maxWidth: "780px" }}>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] md:rounded-[20px]">
          {(selectedWorkflow || attachedDocuments.length > 0 || selectedSources.length > 0) && (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              <SourcePills selectedSources={selectedSources} onRemove={removeSource} />
              {selectedWorkflow && (
                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] py-0.5 pl-2.5 pr-1 text-xs text-[var(--text)] shadow-sm">
                  <Library className="h-2.5 w-2.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{selectedWorkflow.title}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkflow(null);
                      setPendingWorkflow(null);
                    }}
                    className="ml-0.5 rounded-full p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                    aria-label="Remove workflow"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              {attachedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] py-0.5 pl-2 pr-1 text-xs text-[var(--text)] shadow-sm"
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
                    className="ml-0.5 rounded-full p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
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
              placeholder={agentMode ? "Describe a task for Lex Agent..." : "Ask Lex a legal question..."}
              minRows={1}
              maxRows={8}
              className="max-h-48 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:outline-none"
              style={{ lineHeight: 1.5, verticalAlign: "top" }}
            />
          </div>

          <div className="flex flex-nowrap items-center gap-1 p-2 md:p-2.5">
            <div className="flex min-w-0 flex-nowrap items-center gap-1">
              <div className="relative shrink-0" ref={modePopoverRef}>
                <button
                  type="button"
                  onClick={() => { if (!agentMode) setModePopoverOpen((open) => !open); }}
                  aria-pressed={cloudMode}
                  title={agentMode ? "Cloud Mode (locked in Agent Mode)" : cloudMode ? "Cloud Mode" : "Private Mode"}
                  className={`flex h-8 items-center justify-center rounded-lg px-[10px] py-[6px] text-[var(--text-faint)] transition-colors ${agentMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--surface)] hover:text-[var(--text-muted)]'}`}
                >
                  {cloudMode ? (
                    <IconCloud className="h-4 w-4" stroke={1.8} />
                  ) : (
                    <IconLock className="h-4 w-4" stroke={1.8} />
                  )}
                </button>
                {modePopoverOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-[360px] rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
                    <div className="mb-3 flex rounded-full bg-[var(--surface)] p-1">
                      <button
                        type="button"
                        onClick={selectCloudMode}
                        className={`flex-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                          cloudMode
                            ? "bg-[var(--bg)] text-[var(--text-primary)] shadow-sm"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        Cloud Mode
                      </button>
                      <button
                        type="button"
                        onClick={selectPrivateMode}
                        className={`flex-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                          !cloudMode
                            ? "bg-[var(--bg)] text-[var(--text-primary)] shadow-sm"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        Private Mode
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={selectCloudMode}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          cloudMode
                            ? "border-[var(--text-primary)] bg-[var(--surface)]"
                            : "border-[var(--border)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                          <IconCloud className="h-4 w-4" stroke={1.8} />
                          Cloud Mode
                        </div>
                        <p className="mt-1 text-[11px] leading-[1.4] text-[var(--text-muted)]">
                          Groq + Ollama Cloud. Fast. Zero data retention.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={selectPrivateMode}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          !cloudMode
                            ? "border-[var(--text-primary)] bg-[var(--surface)]"
                            : "border-[var(--border)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                          <IconLock className="h-4 w-4" stroke={1.8} />
                          Private Mode
                        </div>
                        <p className="mt-1 text-[11px] leading-[1.4] text-[var(--text-muted)]">
                          Local Ollama only. Nothing leaves your device.
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mx-1 h-5 w-px shrink-0 bg-[var(--border)]" />
              <AddDocButton
                onSelectDoc={handleAddDocument}
                onBrowseAll={() => setDocSelectorOpen(true)}
                selectedDocIds={attachedDocuments.map((doc) => doc.id)}
              />
              <SourcesDropdown
                selectedSources={selectedSources}
                onToggleSource={toggleSource}
              />
              <button
                type="button"
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-[10px] py-[6px] text-sm text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
                onClick={() => setDocSelectorOpen(true)}
                aria-label="Open vault"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vault</span>
              </button>
              <button
                type="button"
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-[10px] py-[6px] text-sm transition-colors ${
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
              {onToggleAgentMode && (
                <button
                  type="button"
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-[10px] py-[6px] text-sm transition-colors ${
                    agentMode
                      ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                      : "text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
                  }`}
                  onClick={onToggleAgentMode}
                  aria-label="Toggle Agent Mode"
                  aria-pressed={agentMode}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Agent</span>
                </button>
              )}

            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {agentMode ? (
                <div className="flex h-8 items-center rounded-lg px-[10px] py-[6px]">
                  <span className="text-sm font-medium text-[var(--text-muted)]">Lex Agent</span>
                </div>
              ) : (
                <ModelSelector disabled={isLoading} direction={modelSelectorDirection} />
              )}
              <button
                type={isLoading ? "button" : "submit"}
                onClick={(event) => {
                  if (isLoading) {
                    event.preventDefault();
                    stop();
                  }
                }}
                disabled={!isLoading && !input.trim()}
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-all duration-150 active:enabled:scale-95 disabled:cursor-default disabled:bg-[var(--border)] disabled:text-[var(--text-faint)] ${
                  agentMode
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "bg-[var(--accent)] text-[var(--bg-primary)]"
                }`}
                aria-label={isLoading ? "Stop response" : "Send message"}
              >
                {isLoading ? (
                  <Square className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                ) : agentMode ? (
                  <Zap className="h-4 w-4" />
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


