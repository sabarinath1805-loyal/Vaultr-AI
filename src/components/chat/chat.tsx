"use client";

import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { ChatRequestOptions, generateId } from "ai";
import { Message, useChat } from "ai/react";
import React from "react";
import useChatStore from "@/app/hooks/useChatStore";
import { usePathname, useRouter } from "next/navigation";
import { SnowflakeIcon } from "@/components/icons/snowflake";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";
import { GROQ_DEFAULT_MODEL, isLexModel } from "@/lib/models";
import { stripAssistantMarkup } from "@/lib/chat-message-content";

type ResponseFlowState = "idle" | "thinking" | "typing" | "streaming" | "done";
const TYPEWRITER_CHARS_PER_SECOND = 500;
const TYPEWRITER_CHARS_PER_TICK = 20;
const THINKING_FADE_MS = 150;

function parseDataStreamLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex < 0) return null;

  const prefix = trimmed.slice(0, separatorIndex);
  const payload = trimmed.slice(separatorIndex + 1);
  if (prefix === "0") {
    return { type: "text" as const, value: JSON.parse(payload) as string };
  }
  if (prefix === "3") {
    return { type: "error" as const, value: JSON.parse(payload) as string };
  }
  return null;
}

function getCounselorGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning, Counselor.";
  if (hour < 17) return "Afternoon, Counselor.";
  return "Evening, Counselor.";
}

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id }: ChatProps) {
  const typewriterTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const thinkingFadeTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const typewriterMessageIdRef = React.useRef<string | null>(null);
  const streamStartedRef = React.useRef(false);
  const rawBufferedContentRef = React.useRef("");
  const bufferedAssistantContentRef = React.useRef("");
  const activeResponseAbortRef = React.useRef<AbortController | null>(null);
  const activeRequestMessagesRef = React.useRef<Message[]>(initialMessages);
  const activeAssistantMessageRef = React.useRef<Message | null>(null);
  const typewriterStateRef = React.useRef<{
    fullContent: string;
    finalAssistantMessage: Message;
    baseMessages: Message[];
    index: number;
  } | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    stop,
    setMessages,
    setInput,
  } = useChat({
    id,
    initialMessages,
    onResponse: () => {},
    onError: async (error) => {
      setLoadingSubmit(false);
      handleResponseError(error);
    },
  });
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [responseFlowState, setResponseFlowState] = React.useState<ResponseFlowState>("idle");
  const [thinkingMessageId, setThinkingMessageId] = React.useState<string | null>(null);
  const [directStreamingActive, setDirectStreamingActive] = React.useState(false);
  const [homeGreeting, setHomeGreeting] = React.useState("Morning, Counselor.");
  React.useEffect(() => {
    setHomeGreeting(getCounselorGreeting());
  }, []);

  React.useEffect(
    () => () => {
      if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
      if (thinkingFadeTimerRef.current) clearTimeout(thinkingFadeTimerRef.current);
    },
    []
  );

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
  const shouldDirectStreamLexMax = false;

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

  const thinkingVisible = responseFlowState !== "idle";

  const clearResponseFlow = React.useCallback(() => {
    if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
    if (thinkingFadeTimerRef.current) clearTimeout(thinkingFadeTimerRef.current);
    typewriterTimerRef.current = null;
    thinkingFadeTimerRef.current = null;
    typewriterMessageIdRef.current = null;
    typewriterStateRef.current = null;
    activeResponseAbortRef.current = null;
    activeAssistantMessageRef.current = null;
    rawBufferedContentRef.current = "";
    bufferedAssistantContentRef.current = "";
    streamStartedRef.current = false;
    setDirectStreamingActive(false);
    setResponseFlowState("idle");
    setThinkingMessageId(null);
  }, []);

  const beginThinking = React.useCallback((directStream = false) => {
    if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
    if (thinkingFadeTimerRef.current) clearTimeout(thinkingFadeTimerRef.current);
    typewriterTimerRef.current = null;
    thinkingFadeTimerRef.current = null;
    typewriterStateRef.current = null;
    typewriterMessageIdRef.current = null;
    rawBufferedContentRef.current = "";
    bufferedAssistantContentRef.current = "";
    activeAssistantMessageRef.current = null;
    streamStartedRef.current = false;
    setDirectStreamingActive(directStream);
    setResponseFlowState("thinking");
    setThinkingMessageId(null);
  }, []);

  const finishResponseFlowAfterFade = React.useCallback(() => {
    if (thinkingFadeTimerRef.current) clearTimeout(thinkingFadeTimerRef.current);
    thinkingFadeTimerRef.current = null;
    setResponseFlowState("idle");
    setThinkingMessageId(null);
  }, []);

  const startTypewriter = React.useCallback(
    async (
      assistantMessage: Message,
      userMessage: Message | null,
      baseMessagesOverride?: Message[]
    ) => {
      const fullContent = stripAssistantMarkup(assistantMessage.content);
      const finalAssistantMessage: Message = {
        ...assistantMessage,
        content: fullContent,
        createdAt: assistantMessage.createdAt || new Date(),
      };
      const visibleAssistantMessage: Message = {
        ...finalAssistantMessage,
        content: "",
      };
      const savedMessages = (baseMessagesOverride || getMessagesById(id)).filter(
        (savedMessage) =>
          stripAssistantMarkup(savedMessage.content).length > 0 &&
          savedMessage.id !== assistantMessage.id &&
          !(
            savedMessage.role === "assistant" &&
            stripAssistantMarkup(savedMessage.content) === fullContent
          )
      );
      const baseMessages =
        userMessage && !savedMessages.some((savedMessage) => savedMessage.id === userMessage.id)
          ? [...savedMessages, userMessage]
          : savedMessages;

      typewriterMessageIdRef.current = finalAssistantMessage.id;
      typewriterStateRef.current = {
        fullContent,
        finalAssistantMessage,
        baseMessages,
        index: 0,
      };
      setResponseFlowState("typing");
      setMessages([...baseMessages, visibleAssistantMessage]);

      const intervalMs = Math.max(1, Math.round(1000 / (TYPEWRITER_CHARS_PER_SECOND / TYPEWRITER_CHARS_PER_TICK)));
      const tick = () => {
        const state = typewriterStateRef.current;
        if (!state) return;

        if (!document.hasFocus()) {
          typewriterStateRef.current = null;
          typewriterTimerRef.current = null;
          typewriterMessageIdRef.current = null;
          activeResponseAbortRef.current = null;
          activeAssistantMessageRef.current = null;
          rawBufferedContentRef.current = "";
          bufferedAssistantContentRef.current = "";
          setMessages([
            ...state.baseMessages,
            state.finalAssistantMessage,
          ]);
          void saveMessages(id, [...state.baseMessages, state.finalAssistantMessage]);
          if (!isOpenEmptyChat) router.replace(`/c/${id}`);
          finishResponseFlowAfterFade();
          return;
        }

        const nextIndex = Math.min(state.fullContent.length, state.index + TYPEWRITER_CHARS_PER_TICK);
        typewriterStateRef.current = { ...state, index: nextIndex };
        const partial = state.fullContent.slice(0, nextIndex);
        setMessages([
          ...state.baseMessages,
          { ...state.finalAssistantMessage, content: partial },
        ]);

        if (nextIndex < state.fullContent.length) {
          typewriterTimerRef.current = setTimeout(tick, intervalMs);
          return;
        }

        typewriterTimerRef.current = null;
        typewriterMessageIdRef.current = null;
        typewriterStateRef.current = null;
        activeResponseAbortRef.current = null;
        activeAssistantMessageRef.current = null;
        rawBufferedContentRef.current = "";
        bufferedAssistantContentRef.current = "";
        void saveMessages(id, [...state.baseMessages, state.finalAssistantMessage]);
        if (!isOpenEmptyChat) router.replace(`/c/${id}`);
        finishResponseFlowAfterFade();
      };

      if (fullContent.length === 0) {
        typewriterMessageIdRef.current = null;
        typewriterStateRef.current = null;
        await saveMessages(id, [...baseMessages, finalAssistantMessage]);
        if (!isOpenEmptyChat) router.replace(`/c/${id}`);
        activeResponseAbortRef.current = null;
        activeAssistantMessageRef.current = null;
        rawBufferedContentRef.current = "";
        bufferedAssistantContentRef.current = "";
        finishResponseFlowAfterFade();
        return;
      }

      typewriterTimerRef.current = setTimeout(tick, intervalMs);
    },
    [
      finishResponseFlowAfterFade,
      getMessagesById,
      id,
      isOpenEmptyChat,
      router,
      saveMessages,
      setMessages,
    ]
  );


  const handleResponseError = React.useCallback(
    async (error: Error) => {
      clearResponseFlow();
      console.error(error.message);
      if (error.cause) console.error(error.cause);

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
    [clearResponseFlow, cloudMode, getMessagesById, id, router, saveMessages, setMessages]
  );

  const handleChatStream = React.useCallback(
    async (
      requestBody: Record<string, unknown>,
      userMessage: Message,
      requestMessages: Message[],
      directStream: boolean
    ) => {
      const abortController = new AbortController();
      activeResponseAbortRef.current = abortController;
      activeRequestMessagesRef.current = requestMessages;
      rawBufferedContentRef.current = "";
      bufferedAssistantContentRef.current = "";

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      activeAssistantMessageRef.current = assistantMessage;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const parsed = parseDataStreamLine(line);
            if (!parsed) continue;
            if (parsed.type === "error") throw new Error(parsed.value);
            if (parsed.type !== "text") continue;

            if (typeof parsed.value !== "string") continue;
            if (rawBufferedContentRef.current == null) continue;

            rawBufferedContentRef.current += parsed.value;
            const nextContent = stripAssistantMarkup(rawBufferedContentRef.current);
            bufferedAssistantContentRef.current = nextContent;

            if (nextContent.length > 0 && !streamStartedRef.current) {
              streamStartedRef.current = true;
            }

            if (!directStream || nextContent.length === 0) continue;

            const visibleAssistantMessage: Message = {
              ...assistantMessage,
              content: nextContent,
            };
            activeAssistantMessageRef.current = visibleAssistantMessage;
            if (!directStreamingActive) {
              setDirectStreamingActive(true);
            }
            setMessages([...requestMessages, visibleAssistantMessage]);
          }
        }

        if (lineBuffer.trim()) {
          const parsed = parseDataStreamLine(lineBuffer);
          if (parsed?.type === "text" && typeof parsed.value === "string") {
            rawBufferedContentRef.current += parsed.value;
            bufferedAssistantContentRef.current = stripAssistantMarkup(
              rawBufferedContentRef.current
            );
          } else if (parsed?.type === "error") {
            throw new Error(parsed.value);
          }
        }

        const finalAssistantMessage: Message = {
          ...assistantMessage,
          ...(activeAssistantMessageRef.current || {}),
          content: stripAssistantMarkup(bufferedAssistantContentRef.current),
          createdAt: assistantMessage.createdAt,
        };

        if (directStream) {
          const nextMessages = finalAssistantMessage.content
            ? [...requestMessages, finalAssistantMessage]
            : requestMessages;
          setMessages(nextMessages);
          await saveMessages(id, nextMessages);
          if (!isOpenEmptyChat) router.replace(`/c/${id}`);
          setDirectStreamingActive(false);
          activeResponseAbortRef.current = null;
          activeAssistantMessageRef.current = null;
          rawBufferedContentRef.current = "";
          bufferedAssistantContentRef.current = "";
          finishResponseFlowAfterFade();
          return;
        }

        await startTypewriter(finalAssistantMessage, userMessage, requestMessages);
      } catch (error) {
        activeResponseAbortRef.current = null;
        activeAssistantMessageRef.current = null;
        rawBufferedContentRef.current = "";
        bufferedAssistantContentRef.current = "";
        setLoadingSubmit(false);
        if ((error as Error).name === "AbortError") return;
        await handleResponseError(error as Error);
      }
    },
    [
      finishResponseFlowAfterFade,
      handleResponseError,
      id,
      isOpenEmptyChat,
      router,
      saveMessages,
      setMessages,
      startTypewriter,
    ]
  );

  const onSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions
  ) => {
    e.preventDefault();
    type ChatRequestBody = {
      workflow?: AttachedWorkflow | null;
      workflowPrompt?: string;
      thinking?: boolean;
      thinkingMode?: boolean;
      ollamaUrl?: string;
      jurisdictionPrompt?: string;
      selectedSources?: string[];
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

    setMessages(nextMessages);
    setLoadingSubmit(true);
    beginThinking(shouldDirectStreamLexMax);
    setThinkingMessageId(userMessage.id);
    const requestPayload = {
      messages: nextMessages,
      selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
      workflow,
      workflowPrompt: workflow?.prompt,
      attachedDocuments: requestBody?.attachedDocuments || [],
      thinking,
      thinkingMode: thinking,
      usePrivacyMode,
      ollamaUrl: requestBody?.ollamaUrl,
      jurisdictionPrompt: requestBody?.jurisdictionPrompt,
      selectedSources: requestBody?.selectedSources,
      directStream: shouldDirectStreamLexMax,
      ...(base64Images ? { data: { images: base64Images } } : {}),
    };

    setInput("");
    void saveMessages(id, nextMessages);
    setBase64Images(null);
    void handleChatStream(requestPayload, userMessage, nextMessages, shouldDirectStreamLexMax);
  };

  const displayedMessages = React.useMemo(() => {
    if (directStreamingActive || responseFlowState !== "thinking") return messages;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (lastMessage?.role !== "assistant") return messages;
    return messages.slice(0, lastIndex);
  }, [directStreamingActive, messages, responseFlowState]);

  const removeLatestMessage = () => {
    const updatedMessages = messages.slice(0, -1);
    setMessages(updatedMessages);
    void saveMessages(id, updatedMessages);
    return updatedMessages;
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    const messageIndex = messages.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return;

    const updatedUserMessage: Message = {
      ...messages[messageIndex],
      content,
      createdAt: new Date(),
    };
    const retryMessages = [
      ...messages.slice(0, messageIndex),
      updatedUserMessage,
    ];

    setMessages(retryMessages);
    await saveMessages(id, retryMessages);
    setLoadingSubmit(true);
    beginThinking(shouldDirectStreamLexMax);
    setThinkingMessageId(updatedUserMessage.id);
    await handleChatStream(
      {
        selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
        workflow: pendingWorkflow,
        workflowPrompt: pendingWorkflow?.prompt,
        usePrivacyMode,
        messages: retryMessages,
        directStream: shouldDirectStreamLexMax,
      },
      updatedUserMessage,
      retryMessages,
      shouldDirectStreamLexMax
    );
  };

  const handleStop = () => {
    stop();
    activeResponseAbortRef.current?.abort();
    setLoadingSubmit(false);
    const activeTypewriterState = typewriterStateRef.current;
    if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
    if (activeTypewriterState) {
      const partialAssistantMessage: Message = {
        ...activeTypewriterState.finalAssistantMessage,
        content: activeTypewriterState.fullContent.slice(0, activeTypewriterState.index),
      };
      const nextMessages = [...activeTypewriterState.baseMessages, partialAssistantMessage];
      setMessages(nextMessages);
      void saveMessages(id, nextMessages);
    } else if (activeAssistantMessageRef.current?.content) {
      const partialAssistantMessage = {
        ...activeAssistantMessageRef.current,
        content: stripAssistantMarkup(activeAssistantMessageRef.current.content),
      };
      const nextMessages = [...activeRequestMessagesRef.current, partialAssistantMessage];
      setMessages(nextMessages);
      void saveMessages(id, nextMessages);
    } else {
      setMessages(activeRequestMessagesRef.current);
      void saveMessages(id, activeRequestMessagesRef.current);
    }
    clearResponseFlow();
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
                    <span style={{ fontSize: '28px', fontFamily: 'serif', lineHeight: 1 }}>✳</span>
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
                  <span style={{ fontSize: '4rem', fontFamily: 'serif', lineHeight: 1 }}>✳</span>
                  {homeGreeting}
                </h1>
              )}
            </div>
            <div className="flex w-full flex-col items-center">
              <ChatBottombar
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={onSubmit}
                isLoading={thinkingVisible || isLoading}
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
            {homeGreeting}
          </h1>
          <ChatList
            messages={displayedMessages}
            isLoading={thinkingVisible || isLoading}
            thinkingVisible={thinkingVisible}
            thinkingMessageId={thinkingMessageId}
            onEditMessage={handleEditMessage}
            reload={async () => {
              const retryMessages = removeLatestMessage();
              const lastRetryMessage = [...retryMessages]
                .reverse()
                .find((message) => message.role === "user");
              if (!lastRetryMessage) return null;

              setLoadingSubmit(true);
              beginThinking(shouldDirectStreamLexMax);
              setThinkingMessageId(lastRetryMessage.id);
              await handleChatStream(
                {
                  selectedModel: usePrivacyMode ? selectedModel : selectedModel || GROQ_DEFAULT_MODEL,
                  usePrivacyMode,
                  workflowPrompt: pendingWorkflow?.prompt,
                  messages: retryMessages,
                  directStream: shouldDirectStreamLexMax,
                },
                lastRetryMessage,
                retryMessages,
                shouldDirectStreamLexMax
              );
              return null;
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
              isLoading={thinkingVisible || isLoading}
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
