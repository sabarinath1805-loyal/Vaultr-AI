"use client";

import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";

export function useReturnDocumentsToComposer() {
  const router = useRouter();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setPendingAttachedDocumentIds = useChatStore(
    (state) => state.setPendingAttachedDocumentIds
  );

  return (documentIds: string[], destination?: string) => {
    setPendingAttachedDocumentIds(documentIds);
    const base = destination || (currentChatId ? `/c/${currentChatId}` : "/");
    const sep = base.includes("?") ? "&" : "?";
    router.push(`${base}${sep}attachDoc=${documentIds.join(",")}`);
  };
}
