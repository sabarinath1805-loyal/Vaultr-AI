import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { useEffect } from "react";
import ChatMessage from "./chat-message";

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
  isThinking?: boolean;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export default function ChatList({
  messages,
  isLoading,
  isThinking,
  reload,
}: ChatListProps) {
  useEffect(() => {
    if (!isThinking || window.__vaultrPhase16RenderTrueLogged) return;

    window.__vaultrPhase16RenderTrueLogged = true;
    window.__vaultrPhase16SeenThinkingTrue = true;

    const message = `❌ THINKING ANIMATION SHOULD RENDER - isThinking is: ${isThinking}`;

    console.log(message);
    if (typeof window !== "undefined") {
      window.__vaultrPhase16Logs = [
        ...(window.__vaultrPhase16Logs ?? []),
        message,
      ];
    }
  }, [isThinking]);

  if (
    !isThinking &&
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
          {isThinking && (
            <div className="animate-message-in max-w-[85%] text-left">
              <div className="mb-2 text-[11px] leading-none text-[var(--text-secondary)]">Lex</div>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '16px 0'}}>
                <svg
                  width="20" height="20" viewBox="0 0 22 22" fill="none"
                  style={{animation: 'lexPulse 1.8s ease-in-out infinite', transformOrigin: 'center'}}
                >
                  <line x1="11" y1="1" x2="11" y2="21" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="1" y1="11" x2="21" y2="11" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="4" y1="4" x2="18" y2="18" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="18" y1="4" x2="4" y2="18" stroke="#1a1916" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{fontSize: '13px', color: '#8a8880', fontFamily: "'DM Sans', sans-serif"}}>Lex is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}