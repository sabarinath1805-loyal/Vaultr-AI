import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import ChatMessage from "./chat-message";
import { LexThinkingIndicator } from "./chat-message";

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
  thinkingPhase: "idle" | "thinking" | "streaming";
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export default function ChatList({
  messages,
  isLoading,
  thinkingPhase,
  reload,
}: ChatListProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-6 pb-[120px] pt-20">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
        <div className="flex flex-col">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
              isLoading={isLoading}
              reload={reload}
            />
          ))}
          {thinkingPhase !== "idle" && (
            <div className="message animate-message-in mb-10 w-full max-w-4xl text-left">
              <LexThinkingIndicator phase={thinkingPhase} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}