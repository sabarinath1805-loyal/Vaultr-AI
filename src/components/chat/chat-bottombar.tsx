import type { ChatRequestOptions } from "@/lib/chat-types";
import type React from "react";
import { MoreHorizontal } from "lucide-react";
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

const HOME_ACTIONS = [
  { label: "Proofread", prompt: "Proofread this document and identify legal drafting issues." },
  { label: "Compare documents", prompt: "Compare these documents and explain the material differences." },
  { label: "Extract key terms", prompt: "Extract the key legal and commercial terms from this document." },
  { label: "Draft from template", prompt: "Help me draft a document from a template." },
];

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
  const isHomeComposer = modelSelectorDirection === "down";

  return (
    <div className={`${className} flex-col items-center`}>
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

      {isHomeComposer && (
        <div className="w-full max-w-[780px] text-center">
          <p className="mb-8 mt-2 text-xs text-gray-500">
            AI can make mistakes. Answers are not legal advice.
          </p>

          <div className="flex flex-col items-center">
            <div className="group relative flex h-5 items-center justify-center">
              <span className="text-xs font-medium text-gray-800">Quick actions</span>
              <span className="absolute left-full ml-1.5 flex h-5 w-5 items-center justify-center text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
              {HOME_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => setInput?.(action.prompt)}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-white/70 bg-white/55 px-3 font-medium text-gray-600 shadow-[0_3px_9px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.86),inset_0_-1px_0_rgba(255,255,255,0.58)] backdrop-blur-xl transition-all hover:bg-white hover:text-gray-900 active:scale-[0.98]"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
