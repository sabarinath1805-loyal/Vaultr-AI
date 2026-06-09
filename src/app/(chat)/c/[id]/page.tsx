"use client";

import { ChatLayout } from "@/components/chat/chat-layout";
import React from "react";
import { notFound } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  const chats = useChatStore((state) => state.chats);
  const loadChatById = useChatStore((state) => state.loadChatById);
  const chat = chats?.[id];
  const [isLoadingChat, setIsLoadingChat] = React.useState(true);

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
    <main className="h-screen">
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
