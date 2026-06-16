import { useEffect, useRef, useState } from "react";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import ChatMessage from "./chat-message";
import { ThinkingBar } from "./thinking-bar";
import type { LegalSearchResult } from "@/lib/legal-search";

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
  thinkingVisible: boolean;
  thinkingMessageId: string | null;
  legalSourcesMap: Record<string, LegalSearchResult>;
  searchingLegalMessageId: string | null;
  activeModel?: string | null;
  agentThinkingActive?: boolean;
  onEditMessage: (messageId: string, content: string) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

function getStandaloneLabel(activeModel?: string | null): string {
  // Tie the bar label to the model tier when we know it; fall back to
  // a generic "Lex" label so the bar reads naturally.
  if (!activeModel) return "Lex";
  if (activeModel.includes("opus-4-8") || activeModel.includes("fable")) {
    return "Lex Max";
  }
  if (activeModel.includes("opus-4-7")) {
    return "Lex Ultra";
  }
  if (activeModel.includes("sonnet-4-6")) {
    return "Lex Pro";
  }
  if (activeModel.includes("haiku-4-5")) {
    return "Lex Core";
  }
  return "Lex";
}

export default function ChatList({
  messages,
  isLoading,
  thinkingVisible,
  thinkingMessageId,
  legalSourcesMap,
  searchingLegalMessageId,
  activeModel,
  agentThinkingActive = false,
  onEditMessage,
  reload,
}: ChatListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastMessageContent = messages[messages.length - 1]?.content || "";
  const latestUserMessageId =
    [...messages].reverse().find((message) => message.role === "user")?.id || null;
  const lastMessage = messages[messages.length - 1];
  const lastIsAssistant = lastMessage?.role === "assistant";
  const showStandaloneThinking =
    thinkingVisible &&
    thinkingMessageId === latestUserMessageId &&
    !lastIsAssistant;
  const showInlineThinking =
    thinkingVisible &&
    thinkingMessageId === latestUserMessageId &&
    lastIsAssistant;

  useEffect(() => {
    if (!isNearBottom) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isNearBottom, messages.length, lastMessageContent, thinkingVisible]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={() => {
        const element = scrollContainerRef.current;
        if (!element) return;
        const distanceFromBottom =
          element.scrollHeight - element.scrollTop - element.clientHeight;
        setIsNearBottom(distanceFromBottom < 100);
      }}
      className="h-full overflow-y-auto px-6 pb-[140px] pt-20"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
        <div className="flex flex-col">
          {messages.map((message, index) => {
            const prevUserMsg = message.role === "assistant" && index > 0
              ? [...messages.slice(0, index)].reverse().find((m) => m.role === "user")?.content
              : undefined;
            return (
              <ChatMessage
                key={message.id || index}
                message={message}
                isLast={index === messages.length - 1}
                isLoading={isLoading}
                showThinking={showInlineThinking && index === messages.length - 1 && message.role === "assistant"}
                legalSources={message.role === "assistant" ? legalSourcesMap[message.id] : undefined}
                isSearchingLegal={message.role === "assistant" && message.id === searchingLegalMessageId}
                previousUserMessage={prevUserMsg}
                activeModel={activeModel}
                onEditMessage={onEditMessage}
                reload={reload}
              />
            );
          })}
          {showStandaloneThinking && !agentThinkingActive && (
            <div className="message animate-message-in w-full text-left">
              <ThinkingBar
                visible
                activeModelLabel={getStandaloneLabel(activeModel)}
                isActive
              />
            </div>
          )}
          {agentThinkingActive && (
            <div className="message animate-message-in w-full text-left">
              <ThinkingBar
                visible
                activeModelLabel="Lex Agent"
                isActive
              />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
