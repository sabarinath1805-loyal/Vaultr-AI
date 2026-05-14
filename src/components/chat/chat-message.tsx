import React, { memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { ChevronRight, RefreshCcw } from "lucide-react";

export type ChatMessageProps = {
  message: Message;
  isLast: boolean;
  isLoading: boolean | undefined;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
};

function ChatMessage({ message, isLast, isLoading, reload }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const { thinkContent, cleanContent } = useMemo(() => {
    const getThinkContent = (content: string) => {
      const matches = Array.from(content.matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/g));
      return matches.length > 0
        ? matches.map((match) => match[1]).join("").trim()
        : null;
    };

    return {
      thinkContent:
        message.role === "assistant" ? getThinkContent(message.content) : null,
      cleanContent: message.content
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "")
        .replace(/<web-search-used\s*\/>/g, "")
        .trim(),
    };
  }, [message.content, message.role]);
  const webSearchUsed = message.content.includes("<web-search-used />");

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const timestamp =
    message.createdAt instanceof Date
      ? message.createdAt.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  if (message.role === "user") {
    return (
      <div className="animate-message-in ml-auto max-w-[480px]">
        <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] px-[14px] py-2.5 text-sm leading-normal text-[var(--text)]">
          {message.content}
        </div>
        {timestamp && (
          <div className="mt-1.5 text-right text-[11px] text-[var(--text-faint)]">
            {timestamp}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-message-in w-full max-w-[680px] text-left text-sm leading-[1.65] text-[var(--text)]">
      <div className="mb-1.5 text-[11px] leading-none text-[var(--text-muted)]">
        Lex
      </div>
      {thinkContent && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setThinkingOpen((open) => !open)}
            className="flex items-center gap-1 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${
                thinkingOpen ? "rotate-90" : ""
              }`}
            />
            Lex&apos;s reasoning
          </button>
          {thinkingOpen && (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-[13px] italic leading-relaxed text-[var(--text-muted)]">
              <Markdown remarkPlugins={[remarkGfm]}>{thinkContent}</Markdown>
            </div>
          )}
        </div>
      )}
      {message.experimental_attachments?.some((attachment) =>
        attachment.contentType?.startsWith("image/")
      ) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {message.experimental_attachments
            ?.filter((attachment) => attachment.contentType?.startsWith("image/"))
            .map((attachment, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${message.id}-${index}`}
                src={attachment.url}
                alt="attached"
                className="max-h-[200px] rounded-[var(--radius-md)] object-contain"
              />
            ))}
        </div>
      )}
      <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:rounded-[var(--radius-sm)] prose-pre:bg-[var(--surface)] prose-pre:p-3 prose-code:rounded-[var(--radius-sm)] prose-code:bg-[var(--surface)] prose-code:px-1 prose-code:py-0.5 prose-code:font-body prose-code:text-[var(--text)]">
        <Markdown remarkPlugins={[remarkGfm]}>{cleanContent}</Markdown>
      </div>
      {timestamp && (
        <div className="pt-1 text-[11px] text-[var(--text-faint)]">
          {timestamp}
        </div>
      )}
      {webSearchUsed && (
        <div className="pt-1 text-[11px] text-[var(--text-muted)]">
          🔍 Web search used
        </div>
      )}
      <div className="flex gap-2 pt-2 text-[var(--text-muted)]">
        {!isLoading && (
          <button
            type="button"
            onClick={handleCopy}
            className="transition-[color,background-color] duration-150 hover:text-[var(--text)]"
            aria-label="Copy response"
          >
            {isCopied ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {!isLoading && isLast && (
          <button
            type="button"
            onClick={() => reload()}
            className="transition-[color,background-color] duration-150 hover:text-[var(--text)]"
            aria-label="Regenerate response"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);