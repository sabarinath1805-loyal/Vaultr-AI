import React, { memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { IconFileText } from "@tabler/icons-react";
import { ChevronRight, Edit3, File, FileText, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/local-documents";
import type { LocalDocument } from "@/lib/local-documents";
import { stripAssistantMarkup } from "@/lib/chat-message-content";
import { SourcesFooter } from "@/components/chat/reasoning-timeline";
import { LegalSourcesPanel } from "@/components/legal-sources-panel";
import type { LegalSearchResult } from "@/lib/legal-search";
import { ThinkingIndicator } from "./thinking-indicator";

function LexAvatar() {
  return (
    <div className="lex-thinking-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 22 22"
        fill="none"
      >
        <line x1="11" y1="1" x2="11" y2="21" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="1" y1="11" x2="21" y2="11" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="4" y1="4" x2="18" y2="18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="18" y1="4" x2="4" y2="18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

export type ChatMessageProps = {
  message: Message & {
    attachedDocuments?: Pick<LocalDocument, "id" | "filename" | "fileType" | "sizeBytes">[];
  };
  isLast: boolean;
  isLoading: boolean | undefined;
  showThinking?: boolean;
  legalSources?: LegalSearchResult | null;
  isSearchingLegal?: boolean;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  onEditMessage: (messageId: string, content: string) => void;
};

function ChatMessage({ message, isLast, isLoading, showThinking, legalSources, isSearchingLegal, reload, onEditMessage }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(message.content);
  const router = useRouter();

  const cleanContent = useMemo(() => stripAssistantMarkup(message.content), [message.content]);
  const isCurrentlyStreaming = Boolean(isLoading && isLast);
  const webSearchMatch = message.content.match(/<web-search-used([^>]*)\/>/);
  const webSearchUsed = Boolean(webSearchMatch);
  const webSearchSources = useMemo(() => {
    const encodedSources = webSearchMatch?.[1]?.match(/\ssources="([^"]*)"/)?.[1];
    if (!encodedSources) return [];
    try {
      const parsed = JSON.parse(decodeURIComponent(encodedSources));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (source): source is { domain: string; url: string } =>
            typeof source?.domain === "string" && typeof source?.url === "string"
        )
        .filter((source) => source.domain && source.url);
    } catch {
      return [];
    }
  }, [webSearchMatch]);
  const documentAnalyzed = Array.from(message.content.matchAll(/<document-analyzed\s+filename="([^"]+)"\s*\/>/g));
  const searchUrls = useMemo(() => {
    const entries = webSearchSources.map((source) => [source.domain, source.url] as const);
    return Object.fromEntries(entries);
  }, [webSearchSources]);
  const sourceFooterDomains = useMemo(
    () => Array.from(new Set(webSearchSources.map((source) => source.domain))),
    [webSearchSources]
  );

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-4 mb-2 text-[var(--text-primary)]">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-semibold mt-4 mb-2 text-[var(--text-primary)]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold mt-3 mb-1 text-[var(--text-primary)]">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-3 leading-[1.75] text-[var(--text-primary)]">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-3 ml-5 list-disc space-y-1 text-[var(--text-primary)]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 ml-5 list-decimal space-y-1 text-[var(--text-primary)]">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1 leading-[1.7]">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
    ),
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
    navigator.clipboard.writeText(cleanContent);
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
      <div className="message animate-message-in mb-4 ml-auto flex w-full flex-col items-end">
        {editing ? (
          <form
            className="w-full max-w-[70%]"
            onSubmit={(event) => {
              event.preventDefault();
              const nextContent = draftContent.trim();
              if (!nextContent || nextContent === message.content) {
                setEditing(false);
                setDraftContent(message.content);
                return;
              }
              setEditing(false);
              onEditMessage(message.id, nextContent);
            }}
          >
            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              className="min-h-[96px] w-full resize-y rounded-[20px] bg-[var(--user-bubble)] px-4 py-3 text-sm leading-[1.6] text-[var(--user-bubble-text)] outline-none ring-1 ring-black/10 focus:ring-black/20"
              autoFocus
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraftContent(message.content);
                }}
                className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-[var(--bg-primary)] hover:opacity-90"
              >
                Save & regenerate
              </button>
            </div>
          </form>
        ) : (
          <div
            data-testid="user-message"
            style={{
              borderRadius: "20px",
              backgroundColor: "var(--user-bubble)",
              color: "var(--user-bubble-text)",
              padding: "12px 16px",
              maxWidth: "70%",
              alignSelf: "flex-end",
              fontFamily: "'Sora', -apple-system, sans-serif",
              fontSize: "14px",
              lineHeight: "1.6",
              wordBreak: "break-word",
            }}
          >
            {message.content}
          </div>
        )}
        {message.attachedDocuments && message.attachedDocuments.length > 0 && (
          <div className="mt-1 flex max-w-[70%] flex-wrap justify-end gap-1.5">
            {message.attachedDocuments.map((document) => (
              <div
                key={document.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {document.fileType === "pdf" ? (
                  <FileText className="h-3 w-3 shrink-0 text-[var(--danger)]" />
                ) : (
                  <File className="h-3 w-3 shrink-0 text-[var(--blue)]" />
                )}
                <span className="max-w-[160px] truncate">{document.filename}</span>
                {typeof document.sizeBytes === "number" && (
                  <span className="text-[var(--text-tertiary)]">
                    {formatBytes(document.sizeBytes)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="message-actions mt-1 flex items-center justify-end gap-2 text-[11px] text-[var(--text-tertiary)]">
          {timestamp && <span>{timestamp}</span>}
          {isLast && (
            <button type="button" onClick={() => reload()} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" aria-label="Regenerate message">
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraftContent(message.content);
              setEditing(true);
            }}
            className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            aria-label="Edit message"
          >
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
      <div className="animate-message-in w-full max-w-4xl">
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
    <div className="message animate-message-in mb-10 w-full max-w-4xl text-left text-sm leading-[1.75] text-[var(--text-primary)]">
      {message.role === "assistant" ? (
        <div className="w-full">
          <div className="min-w-0 text-[15px] leading-[1.75]">
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
            {showThinking && <ThinkingIndicator visible />}
            <div className="prose prose-sm max-w-none text-[15px] leading-[1.75] transition-opacity duration-300 prose-p:my-3 prose-pre:rounded-[var(--radius-sm)] prose-pre:bg-[var(--surface-muted)] prose-pre:p-3 prose-code:rounded-[var(--radius-sm)] prose-code:bg-[var(--surface-muted)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[var(--text-primary)] prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline">
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{cleanContent}</Markdown>
            </div>
            {!isCurrentlyStreaming && webSearchUsed && sourceFooterDomains.length > 0 && (
              <SourcesFooter domains={sourceFooterDomains} urls={searchUrls} />
            )}
            {!isCurrentlyStreaming && (legalSources || isSearchingLegal) && (
              <LegalSourcesPanel
                searchResult={legalSources || null}
                isLoading={isSearchingLegal || false}
              />
            )}
            <div className="message-actions pt-1 text-left text-[11px] text-[var(--text-tertiary)]">
              {timestamp && <div>{timestamp}</div>}
              {documentAnalyzed.map((match) => (
                <div key={match[1]} className="flex items-center gap-1">
                  <IconFileText className="h-3.5 w-3.5 text-[var(--text-muted)]" stroke={1.8} />
                  <span>{match[1]} analyzed</span>
                </div>
              ))}
            </div>
            <div className="message-actions flex gap-2 pt-2 text-[var(--text-muted)]">
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
        </div>
      ) : null}
    </div>
  );
}

export default memo(ChatMessage, (prevProps, nextProps) =>
  prevProps.isLast === nextProps.isLast &&
  prevProps.isLoading === nextProps.isLoading &&
  prevProps.showThinking === nextProps.showThinking &&
  prevProps.legalSources === nextProps.legalSources &&
  prevProps.isSearchingLegal === nextProps.isSearchingLegal &&
  prevProps.message.content === nextProps.message.content &&
  prevProps.message.id === nextProps.message.id
);
