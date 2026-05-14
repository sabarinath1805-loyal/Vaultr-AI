"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { BarChart3, FilePlus2, Folder, StopCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/chat/model-selector";
import { WorkflowsModal } from "@/components/workflows/workflows-modal";

interface ComposerCardProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    event: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  isLoading: boolean;
  stop: () => void;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  modelSelectorDirection?: "up" | "down";
}

const toolbarButtonClass =
  "flex items-center gap-[5px] border-0 bg-transparent text-[13px] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:text-[var(--text)]";

export function ComposerCard({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  setInput,
  modelSelectorDirection = "up",
}: ComposerCardProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [attachedDocuments, setAttachedDocuments] = React.useState<File[]>([]);
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submitFromTextarea = () => {
    const form = textareaRef.current?.form;
    if (form) {
      form.requestSubmit();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitFromTextarea();
    }
  };

  const handleDocumentsSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAttachedDocuments((current) => [...current, ...files]);
    event.target.value = "";
  };

  const useWorkflowPrompt = (prompt: string) => {
    if (setInput) {
      setInput(prompt);
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[680px] max-w-[calc(100%-48px)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] px-4 py-[14px] shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={handleDocumentsSelected}
      />
      {attachedDocuments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachedDocuments.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex items-center rounded-full bg-[var(--text)] px-2 py-0.5 text-xs text-[var(--bg)]"
            >
              {file.name}
            </span>
          ))}
        </div>
      )}
      <TextareaAutosize
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        name="message"
        placeholder="Ask Lex a legal question..."
        minRows={1}
        maxRows={8}
        className="max-h-[200px] min-h-6 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:outline-none"
      />

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus2 size={14} />
            Documents
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => router.push("/vault")}
          >
            <Folder size={14} />
            Vault
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => setWorkflowModalOpen(true)}
          >
            <BarChart3 size={14} />
            Workflows
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector disabled={isLoading} direction={modelSelectorDirection} />
          <button
            type={isLoading ? "button" : "submit"}
            onClick={(event) => {
              if (isLoading) {
                event.preventDefault();
                stop();
              }
            }}
            disabled={!isLoading && !input.trim()}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg)] transition-[color,background-color] duration-150 hover:bg-[rgb(51,51,51)] disabled:bg-[var(--border)] disabled:text-[var(--text-muted)]"
            aria-label={isLoading ? "Stop response" : "Send message"}
          >
            {isLoading ? <StopCircle size={16} /> : <span className="text-base leading-none">→</span>}
          </button>
        </div>
      </div>
      <WorkflowsModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        onUse={useWorkflowPrompt}
      />
    </form>
  );
}
