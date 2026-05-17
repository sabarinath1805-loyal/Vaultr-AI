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
import { X } from "lucide-react";

declare global {
  interface Window {
    __vaultrPhase16Logs?: string[];
    __vaultrPhase16FirstTokenLogged?: boolean;
    __vaultrPhase16RenderFalseLogged?: boolean;
    __vaultrPhase16RenderTrueLogged?: boolean;
    __vaultrPhase16SeenThinkingTrue?: boolean;
  }
}

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id }: ChatProps) {
  const firstTokenLoggedRef = React.useRef(false);
  const hideThinkingTimer = React.useRef<NodeJS.Timeout | null>(null);

  const logPhase16Debug = React.useCallback((message: string) => {
    console.log(message);
    if (typeof window !== "undefined") {
      window.__vaultrPhase16Logs = [
        ...(window.__vaultrPhase16Logs ?? []),
        message,
      ];
    }
  }, []);

  const markFirstTokenArrived = React.useCallback(() => {
    if (firstTokenLoggedRef.current) return;
    firstTokenLoggedRef.current = true;
    if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);
    if (typeof window !== "undefined") {
      window.__vaultrPhase16FirstTokenLogged = true;
    }
    logPhase16Debug('🟢 FIRST TOKEN ARRIVED - isThinking should become false NOW');
    hideThinkingTimer.current = setTimeout(() => {
      setShowThinking(false);
      hideThinkingTimer.current = null;
    }, 800);
  }, [logPhase16Debug]);

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
      router.replace(`/c/${id}`);
    },
    onError: async (error) => {
      setLoadingSubmit(false);
      if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);
      setShowThinking(false);
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
  const [showThinking, setShowThinking] = React.useState(false);
  React.useEffect(() => {
    return () => {
      if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);
    };
  }, []);

  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const setCloudMode = useChatStore((state) => state.setCloudMode);
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
  const [cloudBannerDismissed, setCloudBannerDismissed] = React.useState(false);
  const [cloudWarningCount, setCloudWarningCount] = React.useState(0);

  React.useEffect(() => {
    setCurrentChatId(isOpenEmptyChat ? id : null);
  }, [id, isOpenEmptyChat, setCurrentChatId]);

  React.useEffect(() => {
    if (!pendingComposerText) return;
    setInput(typeof pendingComposerText === "string" ? pendingComposerText : "");
    setPendingComposerText(null);
  }, [pendingComposerText, setInput, setPendingComposerText]);

  React.useEffect(() => {
    if (!input.trim() && loadingSubmit) {
      setLoadingSubmit(false);
    }
  }, [input, loadingSubmit]);

  React.useEffect(() => {
    setCloudWarningCount(readCloudWarningCount());
  }, []);

  const lastMessage = messages[messages.length - 1];
  const assistantResponseStarted =
    lastMessage?.role === "assistant" && lastMessage.content.trim().length > 0;

  React.useEffect(() => {
    if (showThinking && assistantResponseStarted) {
      markFirstTokenArrived();
    }
  }, [showThinking, assistantResponseStarted, markFirstTokenArrived]);

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
    const workflow = (requestBody?.workflow ||
      pendingWorkflow) as AttachedWorkflow | null;
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
      saveMessages(id, nextMessages);
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

    setLoadingSubmit(true);
    firstTokenLoggedRef.current = false;
    if (typeof window !== "undefined") {
      window.__vaultrPhase16FirstTokenLogged = false;
      window.__vaultrPhase16RenderFalseLogged = false;
      window.__vaultrPhase16RenderTrueLogged = false;
      window.__vaultrPhase16SeenThinkingTrue = false;
    }
    logPhase16Debug('🔵 USER SENT MESSAGE - isThinking should become true NOW');
    setShowThinking(true);
    if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);

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

    void append(userMessage, requestOptions);
    setInput("");
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
    if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);
    setShowThinking(false);
  };

  const dismissCloudBanner = () => {
    setCloudWarningCount(incrementCloudWarningCount());
    setCloudBannerDismissed(true);
  };

  const showCloudBanner =
    cloudMode &&
    !cloudBannerDismissed &&
    cloudWarningCount < 3;

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
              {showCloudBanner && (
                <CloudModeBanner
                  onSwitchPrivate={() => {
                    setCloudMode(false, isLexModel(selectedModel) ? selectedModel : null);
                    dismissCloudBanner();
                  }}
                  onDismiss={dismissCloudBanner}
                />
              )}
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
            showThinking={showThinking}
            reload={async () => {
              removeLatestMessage();

              const requestOptions: ChatRequestOptions = {
                body: {
                  selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
                  usePrivacyMode,
                  workflowPrompt: pendingWorkflow?.prompt,
                },
              };

              setLoadingSubmit(true);
              firstTokenLoggedRef.current = false;
              if (typeof window !== "undefined") {
                window.__vaultrPhase16FirstTokenLogged = false;
                window.__vaultrPhase16RenderFalseLogged = false;
                window.__vaultrPhase16RenderTrueLogged = false;
                window.__vaultrPhase16SeenThinkingTrue = false;
              }
              logPhase16Debug('🔵 USER SENT MESSAGE - isThinking should become true NOW');
              setShowThinking(true);
              if (hideThinkingTimer.current) clearTimeout(hideThinkingTimer.current);
              return reload(requestOptions);
            }}
          />
          <div
            className="fixed bottom-6 left-[calc(var(--sidebar-current-w,220px)+(100vw-var(--sidebar-current-w,220px))/2)] z-20 flex w-[calc(100vw-var(--sidebar-current-w,220px)-48px)] -translate-x-1/2 flex-col items-center gap-2 bg-[var(--bg)]"
            style={{ maxWidth: "780px" }}
          >
            {showCloudBanner && (
              <CloudModeBanner
                onSwitchPrivate={() => {
                  setCloudMode(false, isLexModel(selectedModel) ? selectedModel : null);
                  dismissCloudBanner();
                }}
                onDismiss={dismissCloudBanner}
              />
            )}
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

function readCloudWarningCount() {
  if (typeof window === "undefined") return 0;
  const count = Number.parseInt(
    window.localStorage.getItem("cloudWarningCount") || "0",
    10
  );
  return Number.isFinite(count) ? count : 0;
}

function incrementCloudWarningCount() {
  const next = readCloudWarningCount() + 1;
  window.localStorage.setItem("cloudWarningCount", String(next));
  return next;
}

function CloudModeBanner({
  onSwitchPrivate,
  onDismiss,
}: {
  onSwitchPrivate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--color-background-warning)] px-3 py-2 text-[13px] text-[var(--color-text-warning)]">
      <span className="flex-1">
        ☁ Cloud Mode — Documents are processed by Groq. Groq does not use your data for training.
      </span>
      <button
        type="button"
        onClick={onSwitchPrivate}
        className="whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--warning-border)] px-2 py-1 text-[12px] font-medium"
      >
        Switch to Private
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss Cloud Mode warning"
        className="rounded-[var(--radius-sm)] p-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}