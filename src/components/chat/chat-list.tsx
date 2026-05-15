import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import ChatMessage from "./chat-message";

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
  loadingSubmit?: boolean;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export default function ChatList({
  messages,
  isLoading,
  loadingSubmit,
  reload,
}: ChatListProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-6 pb-[120px] pt-20">
      <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col">
        <div className="flex flex-col gap-6">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
              isLoading={isLoading}
              reload={reload}
            />
          ))}
          {loadingSubmit && (
            <div className="animate-message-in max-w-[85%] text-left">
              <div className="mb-1.5 text-xs text-[var(--text-secondary)]">Lex</div>
              <div className="inline-flex gap-1 text-sm leading-[1.7] text-[var(--text-secondary)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}