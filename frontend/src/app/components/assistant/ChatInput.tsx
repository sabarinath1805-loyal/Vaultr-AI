"use client";

import {
    useState,
    useCallback,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from "react";
import {
    Loader2,
} from "lucide-react";
import { UploadOverlay } from "./UploadOverlay";
import { FileTypeIcon } from "../shared/FileTypeIcon";
import { AddDocumentsModal } from "../modals/AddDocumentsModal";
import { AssistantWorkflowModal } from "./AssistantWorkflowModal";
import {
    WORKFLOW_SLASH_MENU_ID,
    WorkflowSlashMenu,
} from "./WorkflowSlashMenu";
import {
    exactSlashWorkflow,
    matchingSlashWorkflows,
    slashCommandQuery,
    workflowSlashCommand,
} from "./workflowSlashCommands";
import { ApiKeyMissingPopup } from "../popups/ApiKeyMissingPopup";
import { ModelToggle, type ModelToggleHandle } from "./ModelToggle";
import { useSelectedModel } from "@/app/hooks/useSelectedModel";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import {
    getModelProvider,
    isModelAvailable,
    type ModelProvider,
} from "@/app/lib/modelAvailability";
import type { Document, Message, Workflow } from "../shared/types";
import type { DirectoryTab } from "../shared/useDirectoryData";
import { cn } from "@/app/lib/utils";
import {
    DropdownMenu,
    DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
    LiquidDropdownContent,
    LiquidDropdownItem,
} from "@/app/components/ui/liquid-dropdown";
import {
    listWorkflows,
    uploadProjectDocument,
    uploadStandaloneDocument,
} from "@/app/lib/vaultrApi";
import {
    formatUnsupportedDocumentWarning,
    partitionSupportedDocumentFiles,
} from "@/app/lib/documentUploadValidation";
import { MovingIcon } from "@/app/components/ui/moving-icon";

export interface ChatInputHandle {
    focus: () => void;
    openModelSelector: () => void;
    addDoc: (doc: Document) => void;
    startWorkflowDocumentSelection: (
        workflow: { id: string; title: string },
        prompt?: string,
        options?: { initialDocumentTab?: DirectoryTab },
    ) => void;
}

interface Props {
    onSubmit: (message: Message) => void;
    onCancel: () => void;
    isLoading: boolean;
    hideAddDocButton?: boolean;
    hideWorkflowButton?: boolean;
    projectName?: string;
    projectCmNumber?: string | null;
    projectId?: string;
    onDocumentsUploaded?: (documents: Document[]) => void;
    placeholder?: string;
    voiceWhenEmpty?: boolean;
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
    {
        onSubmit,
        onCancel,
        isLoading,
        hideAddDocButton,
        hideWorkflowButton,
        projectName,
        projectCmNumber,
        projectId,
        onDocumentsUploaded,
        placeholder = "How can I help you today?",
        voiceWhenEmpty = true,
    }: Props,
    ref,
) {
    const [value, setValue] = useState("");
    const [attachedDocs, setAttachedDocs] = useState<Document[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<{
        id: string;
        title: string;
    } | null>(null);
    const [model, setModel] = useSelectedModel();
    const { profile } = useUserProfile();
    const apiKeys = profile?.apiKeys;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modelToggleRef = useRef<ModelToggleHandle | null>(null);
    const [docSelectorOpen, setDocSelectorOpen] = useState(false);
    const [docSelectorInitialTab, setDocSelectorInitialTab] =
        useState<DirectoryTab>("files");
    const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] =
        useState<ModelProvider | null>(null);
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [uploadingFilenames, setUploadingFilenames] = useState<string[]>([]);
    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
    const [droppedDocuments, setDroppedDocuments] = useState<Document[]>([]);
    const [slashWorkflows, setSlashWorkflows] = useState<Workflow[] | null>(
        null,
    );
    const [activeSlashIndex, setActiveSlashIndex] = useState(0);
    const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);
    const dragDepthRef = useRef(0);

    const slashQuery = slashCommandQuery(value);
    const matchingWorkflows = matchingSlashWorkflows(
        slashWorkflows ?? [],
        slashQuery,
    );
    const slashCommandsLoading = slashQuery !== null && slashWorkflows === null;
    const slashMenuOpen =
        !slashMenuDismissed &&
        !selectedWorkflow &&
        slashQuery !== null &&
        matchingWorkflows.length > 0;
    const canSubmit = !!value.trim() && !slashCommandsLoading;
    const resolvedSlashIndex = Math.min(
        activeSlashIndex,
        Math.max(0, matchingWorkflows.length - 1),
    );

    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus(),
        openModelSelector: () => modelToggleRef.current?.open(),
        addDoc: (doc: Document) => {
            setAttachedDocs((prev) => {
                if (prev.some((d) => d.id === doc.id)) return prev;
                return [...prev, doc];
            });
        },
        startWorkflowDocumentSelection: (workflow, prompt, options) => {
            setSelectedWorkflow(workflow);
            setDocSelectorInitialTab(options?.initialDocumentTab ?? "files");
            if (prompt) {
                setValue((current) => current || prompt);
                requestAnimationFrame(() => {
                    if (!textareaRef.current) return;
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                });
            }
            setDocSelectorOpen(true);
        },
    }));

    useEffect(() => {
        if (!slashCommandsLoading) return;

        let cancelled = false;
        listWorkflows("assistant")
            .then((workflows) => {
                if (!cancelled) setSlashWorkflows(workflows);
            })
            .catch(() => {
                if (!cancelled) setSlashWorkflows([]);
            });

        return () => {
            cancelled = true;
        };
    }, [slashCommandsLoading]);

    const handleAddDocsFromSelector = useCallback(
        (selectedDocs: Document[]) => {
            setAttachedDocs((prev) => {
                const existing = new Set(prev.map((d) => d.id));
                return [
                    ...prev,
                    ...selectedDocs.filter((d) => !existing.has(d.id)),
                ];
            });
        },
        [],
    );

    const addAttachedDocuments = useCallback((documents: Document[]) => {
        setAttachedDocs((prev) => {
            const existing = new Set(prev.map((document) => document.id));
            return [
                ...prev,
                ...documents.filter((document) => !existing.has(document.id)),
            ];
        });
    }, []);

    const handleDroppedFiles = useCallback(
        async (files: File[]) => {
            const { supported, unsupported } =
                partitionSupportedDocumentFiles(files);
            setUploadWarning(formatUnsupportedDocumentWarning(unsupported));
            if (supported.length === 0) return;

            setUploadingFilenames(supported.map((file) => file.name));
            const results = await Promise.allSettled(
                supported.map((file) =>
                    projectId
                        ? uploadProjectDocument(projectId, file)
                        : uploadStandaloneDocument(file),
                ),
            );
            const uploaded = results.flatMap((result) =>
                result.status === "fulfilled" ? [result.value] : [],
            );
            if (uploaded.length > 0) {
                addAttachedDocuments(uploaded);
                setDroppedDocuments((prev) => {
                    const existing = new Set(
                        prev.map((document) => document.id),
                    );
                    return [
                        ...prev,
                        ...uploaded.filter(
                            (document) => !existing.has(document.id),
                        ),
                    ];
                });
                onDocumentsUploaded?.(uploaded);
            }
            if (results.some((result) => result.status === "rejected")) {
                setUploadWarning(
                    uploaded.length > 0
                        ? "Some documents could not be uploaded."
                        : "Documents could not be uploaded. Please try again.",
                );
            }
            setUploadingFilenames([]);
        },
        [addAttachedDocuments, onDocumentsUploaded, projectId],
    );

    useEffect(() => {
        const hasFiles = (dataTransfer: DataTransfer | null) =>
            !!dataTransfer && Array.from(dataTransfer.types).includes("Files");

        const handleDragEnter = (event: DragEvent) => {
            if (!hasFiles(event.dataTransfer)) return;
            event.preventDefault();
            dragDepthRef.current += 1;
            setIsDraggingFiles(true);
        };
        const handleDragOver = (event: DragEvent) => {
            if (!hasFiles(event.dataTransfer)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        };
        const handleDragLeave = (event: DragEvent) => {
            if (!hasFiles(event.dataTransfer)) return;
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDraggingFiles(false);
        };
        const handleDrop = (event: DragEvent) => {
            if (!hasFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            dragDepthRef.current = 0;
            setIsDraggingFiles(false);
            void handleDroppedFiles(Array.from(event.dataTransfer?.files ?? []));
        };

        window.addEventListener("dragenter", handleDragEnter);
        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("drop", handleDrop);
        return () => {
            window.removeEventListener("dragenter", handleDragEnter);
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("drop", handleDrop);
        };
    }, [handleDroppedFiles]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        setActiveSlashIndex(0);
        setSlashMenuDismissed(false);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    };

    const submitMessage = (
        query: string,
        workflow: { id: string; title: string } | null,
    ) => {
        if (!query || isLoading) return;
        if (apiKeys && !isModelAvailable(model, apiKeys)) {
            setApiKeyModalProvider(getModelProvider(model));
            return;
        }
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        const files = attachedDocs.map((d) => ({
            filename: d.filename,
            document_id: d.id,
        }));
        setAttachedDocs([]);
        setSelectedWorkflow(null);

        onSubmit?.({
            role: "user",
            content: query,
            files: files.length > 0 ? files : undefined,
            workflow: workflow ?? undefined,
            model,
        });
    };

    const selectSlashWorkflow = (workflow: Workflow) => {
        if (!workflowSlashCommand(workflow)) return;
        setSelectedWorkflow({
            id: workflow.id,
            title: workflow.metadata.title,
        });
        setValue("");
        setSlashMenuDismissed(true);
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.focus();
        }
    };

    const handleSubmit = () => {
        const query = value.trim();
        if (slashCommandsLoading) return;
        const slashWorkflow = exactSlashWorkflow(
            slashWorkflows ?? [],
            query,
        );
        if (slashWorkflow) {
            selectSlashWorkflow(slashWorkflow);
            return;
        }
        submitMessage(query, selectedWorkflow);
    };

    const handleActionClick = () => {
        if (isLoading) {
            onCancel();
        } else {
            handleSubmit();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (slashMenuOpen && matchingWorkflows.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSlashIndex(
                    (resolvedSlashIndex + 1) % matchingWorkflows.length,
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveSlashIndex(
                    (resolvedSlashIndex - 1 + matchingWorkflows.length) %
                        matchingWorkflows.length,
                );
                return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                selectSlashWorkflow(matchingWorkflows[resolvedSlashIndex]);
                return;
            }
        }
        if (slashMenuOpen && e.key === "Escape") {
            e.preventDefault();
            setSlashMenuDismissed(true);
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <>
            <div className="vaultr-composer relative w-full">
                {slashMenuOpen && (
                    <WorkflowSlashMenu
                        workflows={matchingWorkflows}
                        activeIndex={resolvedSlashIndex}
                        onSelect={selectSlashWorkflow}
                    />
                )}
                <div
                    className="vaultr-composer-surface"
                    data-dragging={isDraggingFiles}
                    data-has-content={
                        canSubmit || attachedDocs.length > 0 || selectedWorkflow
                            ? "true"
                            : "false"
                    }
                    data-loading={isLoading}
                    aria-busy={isLoading}
                >
                    {/* Attached chips */}
                    {(selectedWorkflow || attachedDocs.length > 0) && (
                        <div className="vaultr-composer-attachments flex flex-wrap gap-1.5">
                            {selectedWorkflow && (
                                <div className="vaultr-composer-chip vaultr-composer-chip-workflow inline-flex items-center gap-1">
                                    <MovingIcon name="library" size={10} />
                                    <span className="max-w-[140px] truncate">
                                        {selectedWorkflow.title}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedWorkflow(null)
                                        }
                                        className="rounded-full p-0.5 ml-0.5 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                                        aria-label={`Remove ${selectedWorkflow.title}`}
                                    >
                                        <MovingIcon name="x" size={10} />
                                    </button>
                                </div>
                            )}
                            {attachedDocs.map((doc) => {
                                return (
                                    <div
                                        key={doc.id}
                                        className="vaultr-composer-chip inline-flex items-center gap-1"
                                    >
                                        <FileTypeIcon
                                            fileType={doc.file_type}
                                            className="h-2.5 w-2.5"
                                        />
                                        <span className="max-w-[140px] truncate">
                                            {doc.filename}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAttachedDocs((prev) =>
                                                    prev.filter(
                                                        (d) => d.id !== doc.id,
                                                    ),
                                                )
                                            }
                                            className="ml-0.5 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-900/5 hover:text-gray-700"
                                            aria-label={`Remove ${doc.filename}`}
                                        >
                                        <MovingIcon name="x" size={10} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {uploadingFilenames.length > 0 && (
                        <div className="vaultr-composer-attachments flex flex-wrap items-center gap-1.5">
                            {uploadingFilenames.map((filename, index) => (
                                <div
                                    key={`${filename}-${index}`}
                                    className="vaultr-composer-chip vaultr-composer-chip-loading inline-flex items-center gap-1"
                                >
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    <span className="max-w-[140px] truncate">
                                        {filename}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="vaultr-composer-input-row">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder={placeholder}
                            value={value}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            aria-label="Message"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-controls={
                                slashMenuOpen
                                    ? WORKFLOW_SLASH_MENU_ID
                                    : undefined
                            }
                            aria-expanded={slashMenuOpen}
                            aria-activedescendant={
                                slashMenuOpen && matchingWorkflows.length > 0
                                    ? `${WORKFLOW_SLASH_MENU_ID}-${resolvedSlashIndex}`
                                    : undefined
                            }
                            className="vaultr-composer-textarea w-full resize-none overflow-hidden border-0 p-0 bg-transparent outline-none max-h-48"
                        />
                    </div>

                    {/* Controls */}
                    <div className="vaultr-composer-controls flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="Add content"
                                        className={cn(
                                            "vaultr-composer-plus flex h-9 w-9 items-center justify-center rounded-lg",
                                            (attachedDocs.length > 0 || selectedWorkflow) &&
                                                "vaultr-composer-tool-selected",
                                        )}
                                        data-state={
                                            attachedDocs.length > 0 || selectedWorkflow
                                                ? "selected"
                                                : "idle"
                                        }
                                    >
                                        {attachedDocs.length > 0 ? (
                                            <span className="text-sm font-medium tabular-nums">
                                                {attachedDocs.length}
                                            </span>
                                        ) : (
                                            <MovingIcon name="plus" size={20} />
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                                <LiquidDropdownContent
                                    side="bottom"
                                    align="start"
                                    className="vaultr-composer-menu z-50 w-52 p-1.5"
                                >
                                    {!hideAddDocButton && (
                                        <LiquidDropdownItem
                                            className="vaultr-composer-menu-item"
                                            onSelect={() => {
                                                setDocSelectorInitialTab("files");
                                                setDocSelectorOpen(true);
                                            }}
                                        >
                                            <MovingIcon name="paperclip" size={16} />
                                            <span>Add documents</span>
                                        </LiquidDropdownItem>
                                    )}
                                    {!hideWorkflowButton && (
                                        <LiquidDropdownItem
                                            className="vaultr-composer-menu-item"
                                            onSelect={() => setWorkflowModalOpen(true)}
                                        >
                                            {selectedWorkflow ? (
                                                <MovingIcon name="check" size={16} />
                                            ) : (
                                                <MovingIcon name="workflow" size={16} />
                                            )}
                                            <span>
                                                {selectedWorkflow
                                                    ? selectedWorkflow.title
                                                    : "Use a workflow"}
                                            </span>
                                        </LiquidDropdownItem>
                                    )}
                                </LiquidDropdownContent>
                            </DropdownMenu>
                            <div className="vaultr-composer-model flex items-center">
                                <ModelToggle
                                    ref={modelToggleRef}
                                    value={model}
                                    onChange={setModel}
                                    apiKeys={apiKeys}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label={
                                isLoading ? "Stop response" : "Send message"
                            }
                            className={cn(
                                "vaultr-send-button relative h-9 w-9 flex items-center justify-center rounded-[10px]",
                                voiceWhenEmpty && !isLoading && !canSubmit &&
                                    "vaultr-send-button-idle",
                            )}
                            data-state={
                                isLoading
                                    ? "loading"
                                    : canSubmit
                                      ? "ready"
                                      : "idle"
                            }
                            onClick={handleActionClick}
                            disabled={!isLoading && !canSubmit}
                        >
                            {isLoading ? (
                                <MovingIcon name="square" size={16} />
                            ) : canSubmit || !voiceWhenEmpty ? (
                                <MovingIcon name="arrow-up" size={16} strokeWidth={2} />
                            ) : (
                                <MovingIcon name="audio-lines" size={18} strokeWidth={1.5} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <AddDocumentsModal
                open={docSelectorOpen}
                keepMounted
                onClose={() => setDocSelectorOpen(false)}
                onSelect={handleAddDocsFromSelector}
                initialSelectedDocuments={attachedDocs}
                externalUploadedDocuments={droppedDocuments}
                initialTab={docSelectorInitialTab}
                projectId={projectId}
                breadcrumb={
                    selectedWorkflow
                        ? ["Assistant", selectedWorkflow.title, "Add Documents"]
                        : ["Assistant", "Add Documents"]
                }
            />
            <AssistantWorkflowModal
                open={workflowModalOpen}
                onClose={() => setWorkflowModalOpen(false)}
                onSelect={(wf) => {
                    setSelectedWorkflow({
                        id: wf.id,
                        title: wf.metadata.title,
                    });
                    setWorkflowModalOpen(false);
                }}
                projectName={projectName}
                projectCmNumber={projectCmNumber}
            />
            <ApiKeyMissingPopup
                open={apiKeyModalProvider !== null}
                provider={apiKeyModalProvider}
                onClose={() => setApiKeyModalProvider(null)}
            />
            <UploadOverlay
                open={isDraggingFiles}
                warning={uploadWarning}
                onWarningClose={() => setUploadWarning(null)}
            />
        </>
    );
});


