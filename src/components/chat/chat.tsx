"use client";

import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { generateId } from "ai";
import React from "react";
import type { ChatMessage as Message, ChatRequestOptions } from "@/lib/chat-types";
import useChatStore from "@/app/hooks/useChatStore";
import { usePathname, useRouter } from "next/navigation";
import { SnowflakeIcon } from "@/components/icons/snowflake";
import type { AttachedWorkflow } from "@/app/hooks/useChatStore";
import { ANTHROPIC_CORE_MODEL, isLexModel, groqIdToLexName } from "@/lib/models";
import { AGENT_STEP_IDS } from "@/components/chat/agent-step-tracker";
import { stripAssistantMarkup } from "@/lib/chat-message-content";
import type { LegalSearchResult } from "@/lib/legal-search";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { logError } from "@/lib/logger";
import {
  type ResponseFlowState,
  getChatErrorMessage,
} from "@/components/chat/chat-flow-types";

const TYPEWRITER_CHARS_PER_SECOND = 500;
const TYPEWRITER_CHARS_PER_TICK = 20;
const THINKING_FADE_MS = 150;
// How often the agent-mode elapsed-time counter ticks while the pipeline is
// running. 1s is the resolution exposed in the UI ("12s elapsed" etc).
const AGENT_ELAPSED_TICK_MS = 1000;

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
  const isMountedRef = React.useRef(true);
  React.useEffect(() => () => { isMountedRef.current = false; }, []);

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

  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value),
    []
  );
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const isLoading = loadingSubmit;
  const [responseFlowState, setResponseFlowState] = React.useState<ResponseFlowState>("idle");
  const [thinkingMessageId, setThinkingMessageId] = React.useState<string | null>(null);
  const [directStreamingActive, setDirectStreamingActive] = React.useState(false);
  const [legalSourcesMap, setLegalSourcesMap] = React.useState<Record<string, LegalSearchResult>>({});
  const [searchingLegalMessageId, setSearchingLegalMessageId] = React.useState<string | null>(null);
  const [homeGreeting, setHomeGreeting] = React.useState("Morning, Counselor.");
  const [agentMode, setAgentMode] = React.useState(false);
  const [agentCurrentStep, setAgentCurrentStep] = React.useState<string>("");
  const [agentCompletedSteps, setAgentCompletedSteps] = React.useState<string[]>([]);
  const [agentElapsedSeconds, setAgentElapsedSeconds] = React.useState(0);
  const [agentThinkingActive, setAgentThinkingActive] = React.useState(false);
  const agentElapsedRef = React.useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    setHomeGreeting(getCounselorGreeting());
  }, []);
  const toggleAgentMode = React.useCallback(() => setAgentMode((prev) => !prev), []);

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
  const defaultJurisdiction = useChatStore((state) => state.defaultJurisdiction);
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
      logError("chat", "Chat request failed", {
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
      });

      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: getChatErrorMessage(error, cloudMode),
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

  const handleAgentStream = React.useCallback(
    async (
      message: string,
      userMessage: Message,
      requestMessages: Message[],
      jurisdiction?: string,
      model?: string
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
      setAgentCurrentStep("parse");
      setAgentCompletedSteps([]);
      setAgentElapsedSeconds(0);
      setAgentThinkingActive(true);
      if (agentElapsedRef.current) clearInterval(agentElapsedRef.current);
      agentElapsedRef.current = setInterval(() => {
        setAgentElapsedSeconds((s) => s + 1);
      }, AGENT_ELAPSED_TICK_MS);

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (isSupabaseConfigured()) {
          const supabase = createBrowserSupabaseClient();
          const session = supabase ? (await supabase.auth.getSession()).data.session : null;
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }
        }

        const response = await fetch("/api/agent", {
          method: "POST",
          headers,
          body: JSON.stringify({
            message,
            jurisdiction,
            model: model || selectedModel || ANTHROPIC_CORE_MODEL,
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Agent request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";
        let started = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const sepIdx = trimmed.indexOf(":");
            if (sepIdx < 0) continue;
            const prefix = trimmed.slice(0, sepIdx);
            const payload = trimmed.slice(sepIdx + 1);

            if (prefix === "2") {
              // Data annotation — check for agent_step progress
              try {
                const annotations = JSON.parse(payload);
                if (Array.isArray(annotations)) {
                  for (const ann of annotations) {
                    if (ann.type === "agent_step" && typeof ann.step === "string") {
                      if (ann.status === "active") {
                        setAgentCurrentStep(ann.step);
                      } else if (ann.status === "done") {
                        setAgentCompletedSteps((prev) =>
                          prev.includes(ann.step) ? prev : [...prev, ann.step]
                        );
                      }
                    }
                  }
                }
              } catch {
                // Ignore parse errors
              }
              continue;
            }

            if (prefix === "0") {
              try {
                const text = JSON.parse(payload) as string;
                if (typeof text === "string" && text.length > 0) {
                  if (!started) {
                    started = true;
                    if (agentElapsedRef.current) {
                      clearInterval(agentElapsedRef.current);
                      agentElapsedRef.current = null;
                    }
                    setAgentThinkingActive(false);
                    setResponseFlowState("streaming");
                    setDirectStreamingActive(true);
                  }
                  rawBufferedContentRef.current += text;
                  const nextContent = stripAssistantMarkup(rawBufferedContentRef.current);
                  bufferedAssistantContentRef.current = nextContent;
                  if (isMountedRef.current) {
                    const visibleMsg: Message = { ...assistantMessage, content: nextContent };
                    activeAssistantMessageRef.current = visibleMsg;
                    setMessages([...requestMessages, visibleMsg]);
                  }
                }
              } catch {
                // Ignore
              }
            }
          }
        }

        if (agentElapsedRef.current) {
          clearInterval(agentElapsedRef.current);
          agentElapsedRef.current = null;
        }
        setAgentThinkingActive(false);
        const finalContent = stripAssistantMarkup(bufferedAssistantContentRef.current);
        const finalMsg: Message = {
          ...assistantMessage,
          content: finalContent || "Agent didn't return a response. Please try again.",
          agentMode: true,
        } as Message;

        if (isMountedRef.current) {
          const nextMessages = [...requestMessages, finalMsg];
          setMessages(nextMessages);
          await saveMessages(id, nextMessages);
          if (!isOpenEmptyChat) router.replace(`/c/${id}`);
        }

        setDirectStreamingActive(false);
        activeResponseAbortRef.current = null;
        activeAssistantMessageRef.current = null;
        rawBufferedContentRef.current = "";
        bufferedAssistantContentRef.current = "";
        finishResponseFlowAfterFade();
      } catch (error) {
        if (agentElapsedRef.current) {
          clearInterval(agentElapsedRef.current);
          agentElapsedRef.current = null;
        }
        setAgentThinkingActive(false);
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
      selectedModel,
      setMessages,
    ]
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
        // Build headers — include auth token when Supabase is configured
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (isSupabaseConfigured()) {
          const supabase = createBrowserSupabaseClient();
          const session = supabase ? (await supabase.auth.getSession()).data.session : null;
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        const fallbackTier = response.headers.get("X-Gemini-Fallback");
        if (fallbackTier) {
          toast(`${fallbackTier} is under high demand — responding with Lex Pro instead.`, {
            duration: 5000,
            style: { backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid #d97706" },
          });
        }
        const fallbackModel = response.headers.get("X-Fallback-Model");
        if (fallbackModel) {
          const requestedName = selectedModel ? groqIdToLexName(selectedModel) : "Lex";
          const fallbackName = groqIdToLexName(fallbackModel);
          toast(`${requestedName} is under high demand — responding with ${fallbackName} instead.`, {
            duration: 6000,
            style: { backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid #d97706" },
          });
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
            if (!isMountedRef.current) continue;

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

        let finalAssistantMessage: Message = {
          ...assistantMessage,
          ...(activeAssistantMessageRef.current || {}),
          content: stripAssistantMarkup(bufferedAssistantContentRef.current),
          createdAt: assistantMessage.createdAt,
        };

        // Extract legal sources marker from raw stream content (check both raw and buffered)
        const rawContent = rawBufferedContentRef.current + (lineBuffer || "");
        const legalSourcesMatch = rawContent.match(/<legal-sources\s+data="([^"]*?)"\s*\/>/);
        if (legalSourcesMatch) {
          try {
            const legalData = JSON.parse(decodeURIComponent(legalSourcesMatch[1])) as LegalSearchResult;
            if (legalData.cases.length > 0 || legalData.offline) {
              setLegalSourcesMap((prev) => ({
                ...prev,
                [finalAssistantMessage.id]: legalData,
              }));
            }
          } catch (e) {
            logError("chat", "Failed to parse legal sources", e);
          }
        }
        setSearchingLegalMessageId(null);

        if (!finalAssistantMessage.content.trim()) {
          finalAssistantMessage = {
            ...finalAssistantMessage,
            content: "Lex didn't return a response. Try regenerating.",
          };
        }

        if (directStream) {
          if (!isMountedRef.current) return;
          const nextMessages = [...requestMessages, finalAssistantMessage];
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
      agentMode?: boolean;
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
    beginThinking(false);
    setThinkingMessageId(userMessage.id);
    // Read user profile from localStorage for personalization
    let userProfile: { name?: string; firm?: string; jurisdiction?: string } | undefined;
    try {
      const stored = localStorage.getItem("vaultr_user_profile");
      if (stored) userProfile = JSON.parse(stored);
    } catch { /* ignore */ }

    const requestPayload = {
      messages: nextMessages,
      selectedModel: usePrivacyMode ? selectedModel : selectedModel || ANTHROPIC_CORE_MODEL,
      workflow,
      workflowPrompt: workflow?.prompt,
      attachedDocuments: requestBody?.attachedDocuments || [],
      thinking,
      thinkingMode: thinking,
      usePrivacyMode,
      ollamaUrl: requestBody?.ollamaUrl,
      jurisdictionPrompt: requestBody?.jurisdictionPrompt,
      selectedSources: requestBody?.selectedSources,
      defaultJurisdiction,
      directStream: false,
      ...(base64Images ? { data: { images: base64Images } } : {}),
      ...(userProfile?.name ? { userProfile } : {}),
    };

    setInput("");
    void saveMessages(id, nextMessages);
    setBase64Images(null);

    if (requestBody?.agentMode) {
      void handleAgentStream(
        input,
        userMessage,
        nextMessages,
        typeof defaultJurisdiction === "string" ? defaultJurisdiction : undefined,
        typeof selectedModel === "string" ? selectedModel : undefined
      );
    } else {
      void handleChatStream(requestPayload, userMessage, nextMessages, false);
    }
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
    beginThinking(false);
    setThinkingMessageId(updatedUserMessage.id);
    await handleChatStream(
      {
        selectedModel: usePrivacyMode ? selectedModel : selectedModel || ANTHROPIC_CORE_MODEL,
        workflow: pendingWorkflow,
        workflowPrompt: pendingWorkflow?.prompt,
        usePrivacyMode,
        messages: retryMessages,
        directStream: false,
      },
      updatedUserMessage,
      retryMessages,
      false
    );
  };

  const handleStop = () => {
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
                isLoading={thinkingVisible || isLoading || agentThinkingActive}
                stop={handleStop}
                setInput={setInput}
                modelSelectorDirection="down"
                className="flex w-full justify-center"
                agentMode={agentMode}
                onToggleAgentMode={toggleAgentMode}
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
            isLoading={thinkingVisible || isLoading || agentThinkingActive}
            thinkingVisible={thinkingVisible}
            thinkingMessageId={thinkingMessageId}
            legalSourcesMap={legalSourcesMap}
            searchingLegalMessageId={searchingLegalMessageId}
            activeModel={selectedModel}
            agentThinkingActive={agentThinkingActive}
            agentCurrentStep={agentCurrentStep}
            agentCompletedSteps={agentCompletedSteps}
            agentElapsedSeconds={agentElapsedSeconds}
            onEditMessage={handleEditMessage}
            reload={async () => {
              const retryMessages = removeLatestMessage();
              const lastRetryMessage = [...retryMessages]
                .reverse()
                .find((message) => message.role === "user");
              if (!lastRetryMessage) return null;

              setLoadingSubmit(true);
              beginThinking(false);
              setThinkingMessageId(lastRetryMessage.id);
              await handleChatStream(
                {
                  selectedModel: usePrivacyMode ? selectedModel : selectedModel || ANTHROPIC_CORE_MODEL,
                  usePrivacyMode,
                  workflowPrompt: pendingWorkflow?.prompt,
                  messages: retryMessages,
                  directStream: false,
                },
                lastRetryMessage,
                retryMessages,
                false
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
              isLoading={thinkingVisible || isLoading || agentThinkingActive}
              stop={handleStop}
              setInput={setInput}
              className="flex w-full justify-center"
              agentMode={agentMode}
              onToggleAgentMode={toggleAgentMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
