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
import { GROQ_DEFAULT_MODEL, isLexModel } from "@/lib/models";

type ThinkingPhase = "idle" | "thinking" | "streaming";

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id }: ChatProps) {
  const firstTokenLoggedRef = React.useRef(false);
  const minThinkingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const markFirstTokenArrived = React.useCallback(() => {
    if (firstTokenLoggedRef.current) return;
    firstTokenLoggedRef.current = true;
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    stop,
    setMessages,
    setInput,
    reload,
  } = useChat({
    id,
    initialMessages,
    onResponse: () => {},
    onFinish: async (message) => {
      markFirstTokenArrived();
      const savedMessages = getMessagesById(id);
      const matchingAssistantIndex = savedMessages.findIndex(
        (savedMessage) =>
          savedMessage.role === "assistant" &&
          message.content.trim().length > 0 &&
          savedMessage.content.includes(message.content.trim())
      );
      const savedAssistantMessage =
        matchingAssistantIndex >= 0 ? savedMessages[matchingAssistantIndex] : null;
      await saveMessages(id, [
        ...savedMessages.filter((_, index) => index !== matchingAssistantIndex),
        savedAssistantMessage || message,
      ]);
      setLoadingSubmit(false);
      if (minThinkingTimerRef.current) clearTimeout(minThinkingTimerRef.current);
      setThinkingPhase("idle");
      router.replace(`/c/${id}`);
    },
    onError: async (error) => {
      setLoadingSubmit(false);
      if (minThinkingTimerRef.current) clearTimeout(minThinkingTimerRef.current);
      setThinkingPhase("idle");
      console.error(error.message);
      console.error(error.cause);

      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: cloudMode
          ? "Lex is unavailable. Check your internet connection and try again."
          : "Lex is unavailable. Make sure Ollama is running and try again.",
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
  const [thinkingPhase, setThinkingPhase] = React.useState<ThinkingPhase>("idle");
  const [groqThinkingMinimumMet, setGroqThinkingMinimumMet] = React.useState(true);
  React.useEffect(() => {
    return () => {
      if (minThinkingTimerRef.current) clearTimeout(minThinkingTimerRef.current);
    };
  }, []);

  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const pendingWorkflow = useChatStore((state) => state.pendingWorkflow);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const pendingComposerText = useChatStore((state) => state.pendingComposerText);
  const setPendingComposerText = useChatStore((state) => state.setPendingComposerText);
  const saveMessages = useChatStore((state) => state.saveMessages);
  const getMessagesById = useChatStore((state) => state.getMessagesById);
  const router = useRouter();
  const pathname = usePathname();
  const isOpenEmptyChat = pathname.startsWith("/c/");
  const usePrivacyMode = !cloudMode;

  React.useEffect(() => {
    const nextChatId = isOpenEmptyChat ? id : null;
    const currentChatId = useChatStore.getState().currentChatId;
    if (currentChatId === nextChatId) return;
    setCurrentChatId(nextChatId);
    // Guarding the store write keeps route changes from creating a store update
    // loop while chat messages stream and the layout re-renders.
  }, [id, isOpenEmptyChat, setCurrentChatId]);

  React.useEffect(() => {
    if (!pendingComposerText) return;
    setInput(typeof pendingComposerText === "string" ? pendingComposerText : "");
    setPendingComposerText(null);
    // pendingComposerText is consumed once and immediately cleared from the store,
    // so this effect cannot loop while route/chat state re-renders.
  }, [pendingComposerText, setInput, setPendingComposerText]);

  React.useEffect(() => {
    if (!input.trim() && loadingSubmit) {
      setLoadingSubmit(false);
    }
    // Only input and loadingSubmit are observed here; the setter is stable, and the
    // guard prevents the loading reset from firing repeatedly during streaming.
  }, [input, loadingSubmit]);

  const lastMessage = messages[messages.length - 1];
  const lastAssistantContent =
    lastMessage?.role === "assistant" ? lastMessage.content.trim() : "";
  const assistantVisibleContentLength = lastAssistantContent
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "")
    .replace(/<web-search-used[^>]*\/>\s*/g, "")
    .replace(/<document-analyzed[^>]*\/>/g, "")
    .trim().length;
  const assistantHasDisplayableContent = assistantVisibleContentLength > 30;

  React.useEffect(() => {
    if (thinkingPhase === "idle" || !assistantHasDisplayableContent) return;
    markFirstTokenArrived();
    const nextPhase = usePrivacyMode || groqThinkingMinimumMet ? "streaming" : "thinking";
    setThinkingPhase((current) => (current === nextPhase ? current : nextPhase));
    // This effect watches primitive readiness flags rather than the streaming
    // messages array; the guarded setter only advances thinking -> streaming once.
  }, [
    assistantHasDisplayableContent,
    groqThinkingMinimumMet,
    markFirstTokenArrived,
    thinkingPhase,
    usePrivacyMode,
  ]);

  const beginThinking = React.useCallback(() => {
    setGroqThinkingMinimumMet(usePrivacyMode);
    firstTokenLoggedRef.current = false;
    setThinkingPhase("thinking");
    if (minThinkingTimerRef.current) clearTimeout(minThinkingTimerRef.current);
    if (!usePrivacyMode) {
      minThinkingTimerRef.current = setTimeout(() => {
        setGroqThinkingMinimumMet(true);
        minThinkingTimerRef.current = null;
      }, 1500);
    }
  }, [usePrivacyMode]);

  const onSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    e.preventDefault();
    type ChatRequestBody = {
      workflow?: AttachedWorkflow | null;
      workflowPrompt?: string;
      webSearch?: boolean;
      thinking?: boolean;
      thinkingMode?: boolean;
      ollamaUrl?: string;
      attachedDocuments?: {
        id: string;
        filename: string;
        fileType?: string | null;
        sizeBytes?: number;
        extractedText?: string;
        content?: string;
        dataUrl?: string;
      }[];
    };

    const requestBody = options?.body as ChatRequestBody | undefined;
    const workflow = (requestBody?.workflow || pendingWorkflow) as AttachedWorkflow | null;
    const webSearch = requestBody?.webSearch;
    const thinking = requestBody?.thinking === true;

    if (usePrivacyMode && !isLexModel(selectedModel)) {
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
      void saveMessages(id, nextMessages);
      router.replace(`/c/${id}`);
      return;
    }

    const attachedDocumentMetadata = (requestBody?.attachedDocuments || []).map(
      (document) => ({
        id: document.id,
        filename: document.filename,
        fileType: document.fileType,
        sizeBytes: document.sizeBytes,
      })
    );

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
      createdAt: new Date(),
      attachedDocuments: attachedDocumentMetadata,
    } as Message;
    const nextMessages = [...messages, userMessage];

    setLoadingSubmit(true);
    beginThinking();

    const attachments: Attachment[] = base64Images
      ? base64Images.map((image) => ({
          contentType: "image/base64",
          url: image,
        }))
      : [];

    const requestOptions: ChatRequestOptions = {
      body: {
        selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
        workflow,
        workflowPrompt: workflow?.prompt,
        attachedDocuments: requestBody?.attachedDocuments || [],
        ...(typeof webSearch === "boolean" ? { webSearch } : {}),
        thinking,
        thinkingMode: thinking,
        usePrivacyMode,
        ollamaUrl: requestBody?.ollamaUrl,
      },
      ...(base64Images && {
        data: {
          images: base64Images,
        },
        experimental_attachments: attachments,
      }),
    };

    void append(userMessage, {
      ...requestOptions,
      body: { ...requestOptions.body, messages: nextMessages },
    });
    setInput("");
    void saveMessages(id, nextMessages);
    setBase64Images(null);
    router.replace(`/c/${id}`);
  };

  const removeLatestMessage = () => {
    const updatedMessages = messages.slice(0, -1);
    setMessages(updatedMessages);
    void saveMessages(id, updatedMessages);
    return updatedMessages;
  };

  const handleStop = () => {
    stop();
    saveMessages(id, [...messages]);
    setLoadingSubmit(false);
    if (minThinkingTimerRef.current) clearTimeout(minThinkingTimerRef.current);
    setThinkingPhase("idle");
  };

  return (
    <div className="h-full w-full bg-[var(--bg)]">
      {messages.length === 0 ? (
        <div className="relative h-screen w-full overflow-hidden">
          <div
            className="absolute left-1/2 top-[55%] w-full -translate-x-1/2 -translate-y-1/2 px-6"
            style={{ maxWidth: "780px" }}
          >
            <div className="text-center text-[var(--text)]">
              {isOpenEmptyChat ? (
                <>
                  <h1 className="flex items-center justify-center gap-3 text-[28px] font-normal text-[var(--text)]">
                    <SnowflakeIcon size={28} className="shrink-0 text-[var(--text)]" />
                    Hey, I&apos;m Lex — your private legal AI.
                  </h1>
                  <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                    Ask me anything about your contracts or legal research.
                  </p>
                </>
              ) : (
                <h1
                  className="greeting-heading flex items-center justify-center gap-3 font-normal leading-none text-[var(--text)]"
                  style={{ fontSize: "52px", marginBottom: "28px" }}
                >
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
        </div>
      ) : (
        <div className="relative h-full w-full">
          <h1 className="sr-only" style={{ fontSize: "52px" }}>
            Hi, Counselor
          </h1>
          <ChatList
            messages={messages}
            isLoading={isLoading}
            thinkingPhase={thinkingPhase}
            reload={async () => {
              const retryMessages = removeLatestMessage();

              const requestOptions: ChatRequestOptions = {
                body: {
                  selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
                  usePrivacyMode,
                  workflowPrompt: pendingWorkflow?.prompt,
                },
              };

              setLoadingSubmit(true);
              beginThinking();
              return reload({
                ...requestOptions,
                body: { ...requestOptions.body, messages: retryMessages },
              });
            }}
          />
          <div
            className="fixed bottom-6 left-[calc(var(--sidebar-current-w,220px)+(100vw-var(--sidebar-current-w,220px))/2)] z-20 flex w-[calc(100vw-var(--sidebar-current-w,220px)-48px)] -translate-x-1/2 flex-col items-center gap-2 bg-[var(--bg)]"
            style={{ maxWidth: "780px" }}
          >
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