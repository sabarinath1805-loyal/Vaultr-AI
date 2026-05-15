"use client";

import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { Attachment, ChatRequestOptions, generateId } from "ai";
import { Message, useChat } from "ai/react";
import React from "react";
import useChatStore from "@/app/hooks/useChatStore";
import { usePathname, useRouter } from "next/navigation";
import { SnowflakeIcon } from "@/components/icons/snowflake";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";
import { isLexModel } from "@/lib/models";

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
    onError: async (error) => {
      setLoadingSubmit(false);
      console.error(error.message);
      console.error(error.cause);

      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "Lex is unavailable. Make sure Ollama is running and try again.",
        createdAt: new Date(),
      };

      const savedMessages = getMessagesById(id);
      const nextMessages = [...savedMessages, errorMessage];
      setMessages(nextMessages);
      await saveMessages(id, nextMessages);
      router.replace(`/c/${id}`);
    },
  });
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const pendingWorkflow = useChatStore((state) => state.pendingWorkflow);
  const serperApiKey = useChatStore((state) => state.serperApiKey);
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

  React.useEffect(() => {
    if (!input.trim() && loadingSubmit) {
      setLoadingSubmit(false);
    }
  }, [input, loadingSubmit]);

  const onSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    e.preventDefault();
    const requestBody = options?.body as
      | {
          workflow?: AttachedWorkflow | null;
          webSearch?: boolean;
          thinking?: boolean;
          serperApiKey?: string;
        }
      | undefined;
    const workflow = (requestBody?.workflow ||
      pendingWorkflow) as AttachedWorkflow | null;
    const webSearch = requestBody?.webSearch === true;
    const thinking = requestBody?.thinking === true;


    if (!isLexModel(selectedModel)) {
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: input,
        createdAt: new Date(),
      };
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "LEX_MODEL_REQUIRED",
        createdAt: new Date(),
      };
      const nextMessages = [...messages, userMessage, errorMessage];
      setMessages(nextMessages);
      saveMessages(id, nextMessages);
      router.replace(`/c/${id}`);
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
        workflow,
        webSearch,
        serperApiKey: requestBody?.serperApiKey || serperApiKey,
        thinking,
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
    <div className="h-full w-full bg-[var(--bg)]">
      {messages.length === 0 ? (
        <div className="relative h-screen w-full overflow-hidden">
          <div className="absolute left-1/2 top-[55%] w-full max-w-[680px] -translate-x-1/2 -translate-y-1/2 px-6">
            <div className="text-center text-[var(--text)]">
              {isOpenEmptyChat ? (
                <>
                  <h1 className="font-display flex items-center justify-center gap-3 text-[36px] font-normal leading-none tracking-[-0.02em]">
                    <SnowflakeIcon size={28} className="shrink-0 text-[var(--text)]" />
                    Hey, I&apos;m Lex — your private legal AI.
                  </h1>
                  <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                    Ask me anything about your contracts or legal research.
                  </p>
                </>
              ) : (
                <h1 className="font-display mb-8 flex items-center justify-center gap-3 text-[40px] font-normal leading-none tracking-[-0.02em]">
                  <SnowflakeIcon size={32} className="shrink-0 text-[var(--text)]" />
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
                className="flex w-full justify-center"
              />
            </div>
          </div>
          <p className="fixed bottom-4 left-[calc(var(--sidebar-current-w,220px)+(100vw-var(--sidebar-current-w,220px))/2)] z-10 -translate-x-1/2 whitespace-nowrap text-center text-xs text-[#b8b6b0]">
            Lex is not a substitute for legal advice. Always verify with
            primary sources.
          </p>
        </div>
      ) : (
        <div className="relative h-full w-full">
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
          <div className="fixed bottom-6 left-[calc(var(--sidebar-current-w,220px)+(100vw-var(--sidebar-current-w,220px))/2)] z-20 w-[calc(100vw-var(--sidebar-current-w,220px)-48px)] max-w-[680px] -translate-x-1/2 bg-[var(--bg)]">
            <ChatBottombar
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={onSubmit}
              isLoading={isLoading}
              stop={handleStop}
              setInput={setInput}
              className="flex w-full justify-center"
            />
          </div>
        </div>
      )}
    </div>
  );
}