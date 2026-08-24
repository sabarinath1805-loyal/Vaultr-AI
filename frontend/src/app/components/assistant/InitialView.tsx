"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { MikeIcon } from "@/app/components/chat/mike-icon";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
import { QuickActionsModal } from "./QuickActionsModal";
import { NewProjectModal } from "../projects/NewProjectModal";
import { NewTRModal } from "../tabular/NewTRModal";
import { createTabularReview } from "@/app/lib/mikeApi";
import { useDirectoryData, type DirectoryTab } from "../shared/useDirectoryData";
import {
    QUICK_ACTIONS,
    type QuickActionId,
    useQuickActionsPreference,
} from "./quickActionsPreferences";
import type { Message, Workflow } from "../shared/types";
import { MovingIcon } from "@/app/components/ui/moving-icon";

interface InitialViewProps {
    onSubmit: (message: Message) => void;
}

const DOCUMENT_WORKFLOW_ACTIONS: Partial<
    Record<
        QuickActionId,
        {
            workflowId: string;
            title: string;
            prompt: string;
            initialDocumentTab?: DirectoryTab;
        }
    >
> = {
    proofread: {
        workflowId: "builtin-proofread",
        title: "Proofread",
        prompt: "proofread",
    },
    compareDocuments: {
        workflowId: "builtin-compare-documents",
        title: "Compare Documents",
        prompt: "compare documents",
    },
    extractKeyTerms: {
        workflowId: "builtin-extract-key-terms",
        title: "Extract Key Terms",
        prompt: "extract key terms",
    },
    draftFromTemplate: {
        workflowId: "builtin-draft-from-template",
        title: "Draft from Template",
        prompt: "draft from template",
        initialDocumentTab: "templates",
    },
};

export function InitialView({ onSubmit }: InitialViewProps) {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const router = useRouter();
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [newProjectOpen, setNewProjectOpen] = useState(false);
    const [newTROpen, setNewTROpen] = useState(false);
    const [quickActionsModalOpen, setQuickActionsModalOpen] = useState(false);
    const { visibleActions, setVisibleActions } = useQuickActionsPreference();
    const chatInputRef = useRef<ChatInputHandle>(null);
    const { projects } = useDirectoryData(newTROpen, "projects");

    const displayName =
        profile?.displayName?.trim() || user?.email?.split("@")[0] || "there";
    const username = displayName.split(/\s+/)[0] || "there";
    const visibleQuickActions = QUICK_ACTIONS.filter(
        (action) => visibleActions[action.id],
    ).slice(0, 5);
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    function quickActionIcon(id: QuickActionId) {
        switch (id) {
            case "proofread":
                return <MovingIcon name="check" size={16} />;
            case "compareDocuments":
                return <MovingIcon name="copy" size={16} />;
            case "extractKeyTerms":
                return <MovingIcon name="search" size={16} />;
            case "draftFromTemplate":
                return <MovingIcon name="plus" size={16} />;
            case "newProject":
            case "projectChat":
                return <MovingIcon name="folder" size={16} />;
            case "newTabularReview":
                return <MovingIcon name="table" size={16} />;
            default:
                return <MovingIcon name="workflow" size={16} />;
        }
    }

    function quickActionLabel(id: QuickActionId, fallback: string) {
        switch (id) {
            case "compareDocuments":
                return "Compare";
            case "extractKeyTerms":
                return "Key terms";
            case "draftFromTemplate":
                return "Draft";
            case "projectChat":
                return "Project";
            case "newTabularReview":
                return "Review";
            default:
                return fallback;
        }
    }

    function handleDocumentWorkflowClick(id: QuickActionId) {
        const config = DOCUMENT_WORKFLOW_ACTIONS[id];
        if (!config) return;

        chatInputRef.current?.startWorkflowDocumentSelection(
            {
                id: config.workflowId,
                title: config.title,
            },
            config.prompt,
            { initialDocumentTab: config.initialDocumentTab },
        );
    }

    async function handleNewReview(
        title: string,
        projectId?: string,
        documentIds?: string[],
        columnsConfig?: Workflow["columns_config"],
        documentGrouping?: "document" | "folder",
    ) {
        const review = await createTabularReview({
            title,
            document_ids: documentIds ?? [],
            columns_config: columnsConfig ?? [],
            document_grouping: documentGrouping,
            ...(projectId && { project_id: projectId }),
        });
        setNewTROpen(false);
        router.push(
            projectId
                ? `/projects/${projectId}/tabular-reviews/${review.id}`
                : `/tabular-reviews/${review.id}`,
        );
    }

    function handleQuickAction(id: QuickActionId) {
        if (id === "projectChat") {
            setProjectModalOpen(true);
        } else if (DOCUMENT_WORKFLOW_ACTIONS[id]) {
            handleDocumentWorkflowClick(id);
        } else if (id === "newProject") {
            setNewProjectOpen(true);
        } else if (id === "newTabularReview") {
            setNewTROpen(true);
        }
    }

    return (
        <div className="vaultr-empty-shell flex h-full w-full flex-col items-center px-5">
            <div className="vaultr-empty-stage flex w-full flex-1 flex-col items-center justify-center">
                <div className="vaultr-empty-greeting flex w-full items-center justify-center gap-3">
                    <MikeIcon mike size={30} />
                    <h1 className="whitespace-nowrap font-serif font-normal">
                        {greeting}, {username}
                    </h1>
                </div>

                <div className="vaultr-empty-composer-column mt-[34px] w-full">
                    <ChatInput
                        ref={chatInputRef}
                        onSubmit={onSubmit}
                        onCancel={() => {}}
                        isLoading={false}
                    />
                </div>
                {visibleQuickActions.length > 0 && (
                    <div className="vaultr-quick-actions-wrap relative mt-[15px] flex items-start justify-center">
                        <div className="vaultr-quick-actions-grid">
                            {visibleQuickActions.map((action) => (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => handleQuickAction(action.id)}
                                    className="vaultr-quick-action-chip"
                                    title={action.label}
                                >
                                    {quickActionIcon(action.id)}
                                    <span>
                                        {quickActionLabel(action.id, action.label)}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="group absolute left-full ml-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setQuickActionsModalOpen(true)}
                                aria-label="Configure quick actions"
                                className="vaultr-quick-actions-config flex h-9 w-9 items-center justify-center rounded-lg"
                            >
                                <MovingIcon name="ellipsis" size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <QuickActionsModal
                open={quickActionsModalOpen}
                onClose={() => setQuickActionsModalOpen(false)}
                visibleActions={visibleActions}
                onVisibleActionsChange={setVisibleActions}
            />

            <SelectAssistantProjectModal
                open={projectModalOpen}
                onClose={() => setProjectModalOpen(false)}
            />
            <NewProjectModal
                open={newProjectOpen}
                onClose={() => setNewProjectOpen(false)}
                onCreated={(project) => {
                    setNewProjectOpen(false);
                    router.push(`/projects/${project.id}`);
                }}
            />
            <NewTRModal
                open={newTROpen}
                onClose={() => setNewTROpen(false)}
                onAdd={handleNewReview}
                projects={projects}
            />
        </div>
    );
}

