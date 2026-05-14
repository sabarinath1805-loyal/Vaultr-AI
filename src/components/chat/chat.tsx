"use client";

import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { Attachment, ChatRequestOptions, generateId } from "ai";
import { Message, useChat } from "ai/react";
import React from "react";
import { toast } from "sonner";
import useChatStore from "@/app/hooks/useChatStore";
import { usePathname, useRouter } from "next/navigation";
import { SnowflakeIcon } from "@/components/icons/snowflake";

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id }: ChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
    setInput,
    reload,
  } = useChat({
    id,
    initialMessages,
    onResponse: (response) => {
      if (response) {
        setLoadingSubmit(false);
      }
    },
    onFinish: async (message) => {
      const savedMessages = getMessagesById(id);
      await saveMessages(id, [...savedMessages, message]);
      setLoadingSubmit(false);
      router.replace(`/c/${id}`);
    },
    onError: (error) => {
      setLoadingSubmit(false);
      router.replace("/");
      console.error(error.message);
      console.error(error.cause);
    },
  });
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const pendingComposerText = useChatStore((state) => state.pendingComposerText);
  const setPendingComposerText = useChatStore((state) => state.setPendingComposerText);
  const saveMessages = useChatStore((state) => state.saveMessages);
  const getMessagesById = useChatStore((state) => state.getMessagesById);
  const router = useRouter();
  const pathname = usePathname();
  const isOpenEmptyChat = pathname.startsWith("/c/");

  React.useEffect(() => {
    setCurrentChatId(isOpenEmptyChat ? id : null);
  }, [id, isOpenEmptyChat, setCurrentChatId]);

  React.useEffect(() => {
    if (!pendingComposerText) return;
    setInput(pendingComposerText);
    setPendingComposerText(null);
  }, [pendingComposerText, setInput, setPendingComposerText]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedModel) {
      toast.error("Please select a model");
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
      createdAt: new Date(),
    };

    setLoadingSubmit(true);

    const attachments: Attachment[] = base64Images
      ? base64Images.map((image) => ({
          contentType: "image/base64",
          url: image,
        }))
      : [];

    const requestOptions: ChatRequestOptions = {
      body: {
        selectedModel,
      },
      ...(base64Images && {
        data: {
          images: base64Images,
        },
        experimental_attachments: attachments,
      }),
    };

    handleSubmit(e, requestOptions);
    saveMessages(id, [...messages, userMessage]);
    setBase64Images(null);
    router.replace(`/c/${id}`);
  };

  const removeLatestMessage = () => {
    const updatedMessages = messages.slice(0, -1);
    setMessages(updatedMessages);
    saveMessages(id, updatedMessages);
    return updatedMessages;
  };

  const handleStop = () => {
    stop();
    saveMessages(id, [...messages]);
    setLoadingSubmit(false);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      {messages.length === 0 ? (
        <div className="flex h-full w-full flex-col items-center">
          <div className="flex w-full pt-[40vh] -translate-y-1/2 flex-col items-center gap-8">
            <div className="text-center text-[var(--text)]">
              {isOpenEmptyChat ? (
                <>
                  <h1 className="font-display text-[36px] font-normal leading-none">
                    Hey, I&apos;m Lex — your private legal AI.
                  </h1>
                  <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                    Ask me anything about your contracts or legal research.
                  </p>
                </>
              ) : (
                <h1 className="flex items-center justify-center gap-2 font-display text-[40px] font-normal leading-none">
                  <SnowflakeIcon size={16} className="mt-1 shrink-0 text-[var(--text)]" />
                  Hi, Counselor
                </h1>
              )}
            </div>
            <div className="flex w-full flex-col items-center">
              <ChatBottombar
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={onSubmit}
                isLoading={isLoading}
                stop={handleStop}
                setInput={setInput}
                modelSelectorDirection="down"
              />
              <p className="-mt-2 text-center text-xs text-[var(--text-faint)]">
                Lex is not a substitute for legal advice. Always verify with
                primary sources.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ChatList
            messages={messages}
            isLoading={isLoading}
            loadingSubmit={loadingSubmit}
            reload={async () => {
              removeLatestMessage();

              const requestOptions: ChatRequestOptions = {
                body: {
                  selectedModel,
                },
              };

              setLoadingSubmit(true);
              return reload(requestOptions);
            }}
          />
          <div className="sticky bottom-0 bg-[var(--bg)] pt-2">
            <ChatBottombar
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={onSubmit}
              isLoading={isLoading}
              stop={handleStop}
              setInput={setInput}
            />
          </div>
        </>
      )}
    </div>
  );
}