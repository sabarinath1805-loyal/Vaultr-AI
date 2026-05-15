import React, { memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { ChevronRight, Edit3, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { LEX_MODELS } from "@/lib/models";

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
  const router = useRouter();

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
        .replace(/<web-search-used[^>]*\/>/g, "")
        .replace(/<document-analyzed[^>]*\/>/g, "")
        .trim(),
    };
  }, [message.content, message.role]);
  const webSearchMatch = message.content.match(/<web-search-used(?:\s+model="([^"]+)")?\s*\/>/);
  const webSearchUsed = Boolean(webSearchMatch);
  const webSearchModel = LEX_MODELS.find((model) => model.ollamaId === webSearchMatch?.[1])?.name || "Lex";
  const documentAnalyzed = Array.from(message.content.matchAll(/<document-analyzed\s+filename="([^"]+)"\s*\/>/g));
  const markdownComponents = {
    a: ({
      href,
      children,
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--accent)] no-underline hover:underline"
      >
        {children}
      </a>
    ),
  };

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
      <div className="group animate-message-in ml-auto max-w-[80%]">
        <div className="rounded-[20px] bg-[var(--user-bubble)] px-4 py-3 text-sm leading-normal text-[var(--white)]">
          {message.content}
        </div>
        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-[var(--text-tertiary)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {timestamp && <span>{timestamp}</span>}
          {isLast && (
            <button type="button" onClick={() => reload()} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label="Regenerate message">
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label="Edit message">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleCopy} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label="Copy message">
            {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    );
  }

  if (message.content === "LEX_MODEL_REQUIRED") {
    return (
      <div className="animate-message-in w-full max-w-[680px]">
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--text)]">
          <div>Lex requires a dedicated legal model. Please install a Lex model to start chatting.</div>
          <button
            type="button"
            onClick={() => router.push("/models")}
            className="mt-3 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80"
          >
            → Install a Lex Model
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group animate-message-in w-full max-w-[85%] text-left text-sm leading-[1.7] text-[var(--text-primary)]">
      <div className="mb-2 text-[11px] leading-none text-[var(--text-secondary)]">
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
              <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{thinkContent}</Markdown>
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
      <div className="prose prose-sm max-w-none text-sm leading-[1.7] prose-p:my-2 prose-pre:rounded-[var(--radius-sm)] prose-pre:bg-[var(--surface-muted)] prose-pre:p-3 prose-code:rounded-[var(--radius-sm)] prose-code:bg-[var(--surface-muted)] prose-code:px-1 prose-code:py-0.5 prose-code:font-body prose-code:text-[var(--text-primary)] prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanContent}</Markdown>
      </div>
      <div className="pt-1 text-left text-[11px] text-[var(--text-tertiary)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {timestamp && <div>{timestamp}</div>}
        {webSearchUsed && (
          <div>
            <span className="text-[11px]">🔍</span> Web search used · Prepared using {webSearchModel}
          </div>
        )}
        {documentAnalyzed.map((match) => (
          <div key={match[1]}>
            <span className="text-[11px]">📄</span> {match[1]} analyzed
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2 text-[var(--text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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