"use client";

import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";

export function useReturnDocumentsToComposer() {
  const router = useRouter();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setPendingAttachedDocumentIds = useChatStore(
    (state) => state.setPendingAttachedDocumentIds
  );

  return (documentIds: string[]) => {
    setPendingAttachedDocumentIds(documentIds);
    router.push(currentChatId ? `/c/${currentChatId}` : "/");
  };
}
