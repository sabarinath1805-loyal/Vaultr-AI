"use client";

import { ChatLayout } from "@/components/chat/chat-layout";
import React from "react";
import { notFound } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";

export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;

  const getChatById = useChatStore((state) => state.getChatById);
  const loadChatById = useChatStore((state) => state.loadChatById);
  const chat = getChatById(id);
  const [isLoadingChat, setIsLoadingChat] = React.useState(!chat);

  React.useEffect(() => {
    if (chat) {
      setIsLoadingChat(false);
      return;
    }

    loadChatById(id).then((loadedChat) => {
      if (!loadedChat) {
        setIsLoadingChat(false);
      }
    });
  }, [chat, id, loadChatById]);

  if (isLoadingChat) {
    return null;
  }

  if (!chat) {
    return notFound();
  }

  return (
    <main className="flex h-[calc(100dvh)] flex-col items-center ">
      <ChatLayout
        key={id}
        id={id}
        initialMessages={chat.messages}
        navCollapsedSize={10}
        defaultLayout={[30, 160]}
      />
    </main>
  );
}
