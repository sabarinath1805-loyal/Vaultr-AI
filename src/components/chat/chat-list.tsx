import { useEffect, useRef, useState } from "react";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import ChatMessage from "./chat-message";
import { ThinkingIndicator } from "./thinking-indicator";

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
  thinkingVisible: boolean;
  thinkingMessageId: string | null;
  onEditMessage: (messageId: string, content: string) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export default function ChatList({
  messages,
  isLoading,
  thinkingVisible,
  thinkingMessageId,
  onEditMessage,
  reload,
}: ChatListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastMessageContent = messages[messages.length - 1]?.content || "";
  const latestUserMessageId =
    [...messages].reverse().find((message) => message.role === "user")?.id || null;
  const showStandaloneThinking =
    thinkingVisible &&
    thinkingMessageId === latestUserMessageId;

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
      className="h-full overflow-y-auto px-6 pb-[120px] pt-20"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
        <div className="flex flex-col">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
              isLoading={isLoading}
              onEditMessage={onEditMessage}
              reload={reload}
            />
          ))}
          {showStandaloneThinking && (
            <div className="message animate-message-in w-full text-left">
              <ThinkingIndicator visible />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
