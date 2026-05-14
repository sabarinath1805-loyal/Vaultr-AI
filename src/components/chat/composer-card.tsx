"use client";

import React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatRequestOptions } from "ai";
import { BarChart3, FilePlus2, Folder, StopCircle } from "lucide-react";
import { ModelSelector } from "@/components/chat/model-selector";

interface ComposerCardProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    event: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  isLoading: boolean;
  stop: () => void;
}

const toolbarButtonClass =
  "flex items-center gap-[5px] border-0 bg-transparent text-[13px] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:text-[var(--text)]";

export function ComposerCard({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
}: ComposerCardProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[680px] max-w-[calc(100%-48px)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] px-4 py-[14px] shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
    >
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
          <button type="button" className={toolbarButtonClass}>
            <FilePlus2 size={14} />
            Documents
          </button>
          <button type="button" className={toolbarButtonClass}>
            <Folder size={14} />
            Vault
          </button>
          <button type="button" className={toolbarButtonClass}>
            <BarChart3 size={14} />
            Workflows
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector disabled={isLoading} />
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
    </form>
  );
}
