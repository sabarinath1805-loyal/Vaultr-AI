"use client";

import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import { WorkflowsModal } from "./workflows-modal";

export function WorkflowsRouteModal() {
  const router = useRouter();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setPendingWorkflow = useChatStore((state) => state.setPendingWorkflow);

  const returnToComposer = () => {
    router.push(currentChatId ? `/c/${currentChatId}` : "/");
  };

  return (
    <main className="h-screen bg-[var(--bg)]">
      <WorkflowsModal
        open
        onClose={returnToComposer}
        onUse={(workflow) => {
          setPendingWorkflow(workflow);
          returnToComposer();
        }}
      />
    </main>
  );
}
