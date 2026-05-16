import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { useEffect } from "react";
import ChatMessage from "./chat-message";
import { LexThinkingIndicator } from "./chat-message";

declare global {
  interface Window {
    __vaultrPhase16Logs?: string[];
    __vaultrPhase16FirstTokenLogged?: boolean;
    __vaultrPhase16RenderFalseLogged?: boolean;
    __vaultrPhase16RenderTrueLogged?: boolean;
    __vaultrPhase16SeenThinkingTrue?: boolean;
  }
}

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
  showThinking?: boolean;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export default function ChatList({
  messages,
  isLoading,
  showThinking,
  reload,
}: ChatListProps) {
  useEffect(() => {
    if (!showThinking || window.__vaultrPhase16RenderTrueLogged) return;

    window.__vaultrPhase16RenderTrueLogged = true;
    window.__vaultrPhase16SeenThinkingTrue = true;

    const message = `❌ THINKING ANIMATION SHOULD RENDER - isThinking is: ${showThinking}`;

    console.log(message);
    if (typeof window !== "undefined") {
      window.__vaultrPhase16Logs = [
        ...(window.__vaultrPhase16Logs ?? []),
        message,
      ];
    }
  }, [showThinking]);

  if (
    !showThinking &&
    typeof window !== "undefined" &&
    window.__vaultrPhase16SeenThinkingTrue &&
    window.__vaultrPhase16FirstTokenLogged &&
    !window.__vaultrPhase16RenderFalseLogged
  ) {
    window.__vaultrPhase16RenderFalseLogged = true;
    const message = "❌ THINKING ANIMATION SHOULD RENDER - isThinking is: false";

    console.log(message);
    window.__vaultrPhase16Logs = [
      ...(window.__vaultrPhase16Logs ?? []),
      message,
    ];
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-6 pb-[120px] pt-20">
      <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col">
        <div className="flex flex-col gap-8">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
              isLoading={isLoading}
              reload={reload}
            />
          ))}
          {showThinking && (
            <div className="animate-message-in max-w-[85%] text-left">
              <LexThinkingIndicator />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}