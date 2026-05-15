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
              <div className="lex-thinking inline-flex flex-col items-start gap-2 text-[13px] leading-[1.7] text-[var(--text-secondary)]">
                <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                  <line x1="11" y1="1" x2="11" y2="21" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="1" y1="11" x2="21" y2="11" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="4" y1="4" x2="18" y2="18" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="18" y1="4" x2="4" y2="18" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span>Lex is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}