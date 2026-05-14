"use client";

import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import { WorkflowsModal } from "./workflows-modal";

export function WorkflowsRouteModal() {
  const router = useRouter();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setPendingComposerText = useChatStore((state) => state.setPendingComposerText);
  const setPendingWorkflowTitle = useChatStore((state) => state.setPendingWorkflowTitle);

  const returnToComposer = () => {
    router.push(currentChatId ? `/c/${currentChatId}` : "/");
  };

  return (
    <main className="h-screen bg-[var(--bg)]">
      <WorkflowsModal
        open
        onClose={returnToComposer}
        onUse={(prompt) => {
          setPendingComposerText(prompt);
          setPendingWorkflowTitle(prompt.match(/^##\s+(.+)$/m)?.[1] ?? "Workflow");
          returnToComposer();
        }}
      />
    </main>
  );
}
