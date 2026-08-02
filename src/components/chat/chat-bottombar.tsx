import type { ChatRequestOptions } from "@/lib/chat-types";
import type React from "react";
import { ComposerCard } from "@/components/chat/composer-card";

interface ChatBottombarProps {
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  isLoading: boolean;
  stop: () => void;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  input: string;
  modelSelectorDirection?: "up" | "down";
  className?: string;
  agentMode?: boolean;
  onToggleAgentMode?: () => void;
}

export default function ChatBottombar({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  setInput,
  modelSelectorDirection,
  className = "flex w-full justify-center px-6 pb-5",
  agentMode,
  onToggleAgentMode,
}: ChatBottombarProps) {
  return (
    <div className={className}>
      <ComposerCard
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        setInput={setInput}
        modelSelectorDirection={modelSelectorDirection}
        agentMode={agentMode}
        onToggleAgentMode={onToggleAgentMode}
      />
    </div>
  );
}
