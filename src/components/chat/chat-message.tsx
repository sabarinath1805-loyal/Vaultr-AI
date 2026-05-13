import React, { memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { RefreshCcw } from "lucide-react";

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

  const { thinkContent, cleanContent } = useMemo(() => {
    const getThinkContent = (content: string) => {
      const match = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
      return match ? match[1].trim() : null;
    };

    return {
      thinkContent:
        message.role === "assistant" ? getThinkContent(message.content) : null,
      cleanContent: message.content
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "")
        .trim(),
    };
  }, [message.content, message.role]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[480px] rounded-[var(--radius-lg)] bg-[var(--surface)] px-[14px] py-2.5 text-sm leading-normal text-[var(--text)]">
        {message.content}
      </div>
    );
  }

  return (
    <div className="max-w-[680px] text-left text-sm leading-[1.65] text-[var(--text)]">
      <div className="mb-1.5 text-[11px] leading-none text-[var(--text-muted)]">
        Lex
      </div>
      {thinkContent && (
        <details className="mb-3 text-sm text-[var(--text-muted)]">
          <summary className="cursor-pointer transition-[color,background-color] duration-150 hover:text-[var(--text)]">
            Thinking process
          </summary>
          <div className="mt-2">
            <Markdown remarkPlugins={[remarkGfm]}>{thinkContent}</Markdown>
          </div>
        </details>
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
      <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:rounded-[var(--radius-sm)] prose-pre:bg-[var(--surface)] prose-pre:p-3 prose-code:rounded-[var(--radius-sm)] prose-code:bg-[var(--surface)] prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[var(--text)]">
        <Markdown remarkPlugins={[remarkGfm]}>{cleanContent}</Markdown>
      </div>
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