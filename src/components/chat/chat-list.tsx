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
    <div className="flex min-h-0 flex-1 overflow-y-auto px-6">
      <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col justify-end py-6">
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
            <div className="animate-message-in max-w-[680px] text-left">
              <div className="mb-1.5 text-[11px] text-[var(--text-muted)]">Lex</div>
              <div className="text-sm leading-[1.65] text-[var(--text-muted)]">
                Thinking…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}