import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { IconFileText } from "@tabler/icons-react";
import { ChevronRight, Download, Edit3, File, FileText, FileDown, Flag, RefreshCcw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/local-documents";
import type { LocalDocument } from "@/lib/local-documents";
import { stripAssistantMarkup } from "@/lib/chat-message-content";
import { SourcesFooter } from "@/components/chat/reasoning-timeline";
import { LegalSourcesPanel } from "@/components/legal-sources-panel";
import type { LegalSearchResult } from "@/lib/legal-search";
import { ThinkingBar } from "./thinking-bar";

// Detect generate_docx tool calls in message content
const DOCX_TOOL_REGEX = /generate_docx\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
const DOCX_JSON_REGEX = /\{\s*"tool_(?:code|name)"\s*:\s*"generate_docx"[\s\S]*?"(?:arguments|params|parameters)"\s*:\s*(\{[\s\S]*?\})\s*\}/g;

// Document type patterns for auto-detect
const DOCUMENT_PATTERNS: { regex: RegExp; prefix: string }[] = [
  { regex: /\b(?:non[- ]?disclosure agreement|nda|confidentiality agreement)\b/i, prefix: "NDA" },
  { regex: /\b(?:memorandum of understanding|mou)\b/i, prefix: "MOU" },
  { regex: /\b(?:service (?:level )?agreement|sla)\b/i, prefix: "Service_Agreement" },
  { regex: /\b(?:employment (?:agreement|contract))\b/i, prefix: "Employment_Contract" },
  { regex: /\b(?:lease agreement|tenancy agreement)\b/i, prefix: "Lease_Agreement" },
  { regex: /\b(?:terms (?:of|and) (?:service|use)|tos)\b/i, prefix: "Terms_of_Service" },
  { regex: /\b(?:privacy policy)\b/i, prefix: "Privacy_Policy" },
  { regex: /\b(?:legal opinion|legal memorandum)\b/i, prefix: "Legal_Opinion" },
  { regex: /\b(?:contract|agreement)\b/i, prefix: "Contract" },
];

const MIN_DOCUMENT_LENGTH = 800;

// Only show docx download when user explicitly requested document generation
const DOCX_REQUEST_KEYWORDS = /\b(?:draft|generate|create a document|download|word doc|docx|write me a contract|prepare an agreement|write me an? (?:nda|contract|agreement|lease|memorandum|letter)|generate a (?:document|contract|agreement))\b/i;

function detectDocumentType(content: string, userMessage?: string): string | null {
  // Only auto-detect if user explicitly asked for a document
  if (!userMessage || !DOCX_REQUEST_KEYWORDS.test(userMessage)) return null;
  if (content.length < MIN_DOCUMENT_LENGTH) return null;
  // Must have structure: multiple headings or numbered clauses
  const headingCount = (content.match(/^#{1,3}\s+/gm) || []).length;
  const clauseCount = (content.match(/^\d+\.\s+/gm) || []).length;
  if (headingCount < 3 && clauseCount < 3) return null;
  for (const { regex, prefix } of DOCUMENT_PATTERNS) {
    if (regex.test(content)) return prefix;
  }
  // Generic long structured response
  return headingCount >= 5 ? "Legal_Document" : null;
}

function extractDocxCalls(content: string): { title: string; sections: unknown[]; landscape?: boolean }[] {
  const results: { title: string; sections: unknown[]; landscape?: boolean }[] = [];
  const patterns = [DOCX_TOOL_REGEX, DOCX_JSON_REGEX];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.title && Array.isArray(parsed.sections)) {
          results.push(parsed);
        }
      } catch { /* ignore parse errors */ }
    }
  }
  return results;
}

function DocxDownloadButton({ params }: { params: { title: string; sections: unknown[]; landscape?: boolean } }) {
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  const generate = useCallback(async () => {
    setStatus("generating");
    try {
      const response = await fetch("/api/generate-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error("Generation failed");
      const data = await response.json();
      setDownloadUrl(data.url);
      setFilename(data.filename || `${params.title}.docx`);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [params]);

  useEffect(() => {
    generate();
  }, [generate]);

  if (status === "generating") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
        Generating document...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-3 text-sm">
        <span className="text-[var(--danger)]">Document generation failed.</span>
        <button type="button" onClick={generate} className="text-[var(--accent)] hover:underline">Retry</button>
      </div>
    );
  }

  if (status === "ready" && downloadUrl) {
    return (
      <a
        href={downloadUrl}
        download={filename}
        className="my-3 flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)] no-underline"
      >
        <Download className="h-4 w-4 text-[var(--accent)]" />
        <span>{filename}</span>
        <span className="text-[var(--text-muted)]">— Download</span>
      </a>
    );
  }

  return null;
}

function DocumentArtifactButton({ content, docType }: { content: string; docType: string }) {
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${docType}_${dateStr}.docx`;

  const generate = useCallback(async () => {
    setStatus("generating");
    try {
      const response = await fetch("/api/export-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format: "docx", title: docType.replace(/_/g, " ") }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const data = await response.json();
      setDownloadUrl(data.url);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [content, docType]);

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={generate}
        className="my-3 flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent)]/30 bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]"
      >
        <Download className="h-4 w-4 text-[var(--accent)]" />
        <span>Download as Word — {filename}</span>
      </button>
    );
  }

  if (status === "generating") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
        Generating {filename}...
      </div>
    );
  }

  if (status === "ready" && downloadUrl) {
    return (
      <a
        href={downloadUrl}
        download={filename}
        className="my-3 flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)] no-underline"
      >
        <Download className="h-4 w-4 text-[var(--accent)]" />
        <span>{filename}</span>
        <span className="text-[var(--text-muted)]">— Download</span>
      </a>
    );
  }

  return (
    <div className="my-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-2.5 text-sm">
      <span className="text-[var(--danger)]">Failed to generate document.</span>
      <button type="button" onClick={generate} className="text-[var(--accent)] hover:underline">Retry</button>
    </div>
  );
}

function ExportButtons({ content, messageId }: { content: string; messageId: string }) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleExport = useCallback(async (format: "pdf" | "docx") => {
    setExporting(format);
    setMenuOpen(false);
    try {
      const response = await fetch("/api/export-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, title: "Lex Response" }),
      });
      if (!response.ok) throw new Error("Export failed");
      const data = await response.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || `lex-response.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      console.error(`Failed to export as ${format}`);
    } finally {
      setExporting(null);
    }
  }, [content]);

  if (!content || content.length < 20) return null;

  return (
    <div ref={menuRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="flex h-[28px] w-[28px] items-center justify-center transition-[color,background-color] duration-150 hover:text-[var(--text)]"
        aria-label="Export response"
        title="Export response"
      >
        {exporting ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
      </button>
      {menuOpen && (
        <div className="absolute bottom-6 left-0 z-50 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            <FileText className="h-3.5 w-3.5 text-[var(--danger)]" /> Download as PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("docx")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            <File className="h-3.5 w-3.5 text-[var(--blue,#378ADD)]" /> Export to Word
          </button>
        </div>
      )}
    </div>
  );
}

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

// Only match real legal citations:
// 1. Case names with " v " (spaces required): "Smith v Jones"
// 2. Statute/Act names: "Companies Act", "Penal Code", "SFA", etc.
// 3. Section references: "s.123", "ss 123, 124"
// 4. Court report citations: "[2013] SGCA 8", "[1994] 3 SLR 452"
const CITATION_REGEX = /(?:(?:[A-Z][a-zA-Z']+)(?:\s+(?:v\.?|vs\.?|versus)\s+)(?:[A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*))|(?:[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]*)+(?:\s+(?:Act|Code|Ordinance|Regulation|Rules|Laws?|SFA|Civil\s+Procedure|Evidence\s+Act|Criminal\s+Procedure|Companies?|Constitution))(?:\s+(?:Cap\.?|Chapter|Act|No\.?|\d+(?:\([a-z0-9]+\))?))?)|(?:\bs\.?\s*\d+[a-z]?(?:\([a-z0-9]+\))?(?:[\s,]*(?:s\.?\s*\d+[a-z]?(?:\([a-z0-9]+\))?))*)|(?:\[\d{4}\]\s*\d+\s*[A-Z]{2,}\s*\d+(?:\([a-z]+\))?)|(?:\[\d{4}\]\s*[A-Z]{2,}\s*\d+)|(?:\b\d+\s+[A-Z]{2,}\s*\d{3}(?:[\s,]+\d+\s+[A-Z]{2,}\s*\d{3})*)/g;

const JURISDICTION_BADGES: Record<string, string> = {
  "SGCA": "SG", "SGHC": "SG", "SGDC": "SG", "SGX": "SG", "SSO": "SG",
  "EWCA": "UK", "EWHC": "UK", "UKSC": "UK", "UKHL": "UK",
  "HCA": "AU", "FCA": "AU", "NSWCA": "AU", "VSC": "AU",
  "SCC": "CA", "FCC": "CA",
  "US": "US", "F.": "US", "S.Ct": "US",
  "CJEU": "EU", "ECJ": "EU",
};

// Secondary filters: reject non-legal fragments like headings or sentence mid-points
const NON_CITATION_WORDS = /^(?:the|this|that|which|where|when|what|who|how|and|but|or|for|with|from|have|has|be|was|are|been|being|been|not|all|some|any|each|every|such|said|stated|found|noted|held|given|under|above|below|into|through|during|after|before|since|until|while|upon|against|among|between|during|under|over|across|behind|beyond|within|without|along|around|about|towards|upon|since)$/i;
const IS_HEADING_WORD = /^(?:background|facts|analysis|discussion|conclusion|summary|introduction|overview|details?|examples?|issues?|options?|recommendations?|next steps?|references?|further|additional|related|relevant|following|above|below|please|here|there|also|however|therefore|thus|hence|whereas|whereby|therefore|according|regarding|concerning|insofar)$/i;

interface ParsedCitation {
  text: string;
  jurisdiction: string;
  year: string;
}

function isRealCitation(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // Must contain at least one legal citation anchor
  if (/\bv\.?\s/i.test(t)) return true;                        // case name with " v "
  if (/\[?\d{4}\]?/.test(t)) return true;                      // year present
  if (/\bs\.?\s*\d+/i.test(t)) return true;                   // section reference
  if (/(?:Act|Code|Ordinance|Regulation|SFA)\b/i.test(t)) return true; // statute name
  return false;
}

function extractCitations(content: string): ParsedCitation[] {
  const matches = content.match(CITATION_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  const citations: ParsedCitation[] = [];
  for (const raw of matches) {
    const text = raw.trim();
    if (text.length < 4 || seen.has(text)) continue;
    if (!isRealCitation(text)) continue;
    const firstWord = text.split(/\s+/)[0];
    if (NON_CITATION_WORDS.test(firstWord)) continue;
    if (IS_HEADING_WORD.test(firstWord)) continue;
    seen.add(text);
    const yearMatch = text.match(/\[?(\d{4})\]?/);
    const year = yearMatch ? yearMatch[1] : "";
    let jurisdiction = "";
    for (const [key, badge] of Object.entries(JURISDICTION_BADGES)) {
      if (text.includes(key)) { jurisdiction = badge; break; }
    }
    citations.push({ text, jurisdiction, year });
  }
  return citations;
}

function expandSectionReference(text: string): string {
  return text
    .replace(/\bss\.\s*(\d+)/g, (_, num) => `Sections ${num}`)
    .replace(/\bs\.\s*(\d+)/g, (_, num) => `Section ${num}`)
    .replace(/\bSection\s+(\d+)\s*,\s*Section\s+(\d+)/g, "Sections $1, $2");
}

function CitationsPanel({ content, attachedDocuments }: { content: string; attachedDocuments?: { filename: string }[] }) {
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [feedbackIdx, setFeedbackIdx] = useState<number | null>(null);
  const [submittedFeedback, setSubmittedFeedback] = useState<Record<number, string>>({});
  const citations = useMemo(() => extractCitations(content), [content]);
  const hasDocuments = attachedDocuments && attachedDocuments.length > 0;
  const hasCitations = citations.length > 0;

  if (!hasCitations && !hasDocuments) return null;

  return (
    <div className="mt-3 space-y-2">
      {hasDocuments && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]">
          <button
            type="button"
            onClick={() => setDocsOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Documents in context</span>
            <ChevronRight className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${docsOpen ? "rotate-90" : ""}`} />
          </button>
          {docsOpen && (
            <div className="border-t border-[var(--border)] px-3 py-2">
              {attachedDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1 text-[13px] text-[var(--text-primary)]">
                  <FileText className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                  <span>{doc.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {hasCitations && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]">
          <button
            type="button"
            onClick={() => setCitationsOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <span className="font-medium">{citations.length} citation{citations.length !== 1 ? "s" : ""}</span>
            <ChevronRight className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${citationsOpen ? "rotate-90" : ""}`} />
          </button>
          {citationsOpen && (
            <div className="border-t border-[var(--border)] px-3 py-2">
              {citations.map((c, idx) => (
                <div key={idx} className="py-1">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-[11px] font-medium text-[var(--text-tertiary)] tabular-nums" style={{ minWidth: "18px" }}>{idx + 1}.</span>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(c.text + " law")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[13px] text-[var(--text-primary)] hover:underline cursor-pointer"
                    >
                      {expandSectionReference(c.text)}
                      <span className="text-xs opacity-50">↗</span>
                    </a>
                    {c.jurisdiction && (
                      <span className="shrink-0 rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">{c.jurisdiction}</span>
                    )}
                    {c.year && (
                      <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{c.year}</span>
                    )}
                    {submittedFeedback[idx] ? (
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--text-tertiary)]">{submittedFeedback[idx]}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFeedbackIdx(feedbackIdx === idx ? null : idx)}
                        className="ml-auto shrink-0 text-[12px] text-[var(--text-tertiary)] opacity-50 transition-opacity hover:opacity-100"
                        title="Flag this citation"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {feedbackIdx === idx && !submittedFeedback[idx] && (
                    <div className="ml-6 mt-1 flex items-center gap-2 text-[11px]">
                      <span className="text-[var(--text-muted)]">Accurate?</span>
                      {(["✓ Correct", "✗ Wrong case", "? Unverified"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setSubmittedFeedback((prev) => ({ ...prev, [idx]: option }));
                            setFeedbackIdx(null);
                          }}
                          className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  previousUserMessage?: string;
  activeModel?: string | null;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  onEditMessage: (messageId: string, content: string) => void;
};

function getInlineModelLabel(activeModel?: string | null): string {
  if (!activeModel) return "Lex";
  if (activeModel.includes("opus-4-8") || activeModel.includes("fable")) {
    return "Lex Max";
  }
  if (activeModel.includes("opus-4-7")) {
    return "Lex Ultra";
  }
  if (activeModel.includes("sonnet-4-6")) {
    return "Lex Pro";
  }
  if (activeModel.includes("haiku-4-5")) {
    return "Lex Core";
  }
  return "Lex";
}

function ChatMessage({ message, isLast, isLoading, showThinking, legalSources, isSearchingLegal, previousUserMessage, activeModel, reload, onEditMessage }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(message.content);
  const router = useRouter();

  const cleanContent = useMemo(() => stripAssistantMarkup(message.content), [message.content]);
  const docxCalls = useMemo(() => message.role === "assistant" ? extractDocxCalls(message.content) : [], [message.content, message.role]);
  // Parse inline legal sources marker from message content (covers persisted messages)
  const inlineLegalSources = useMemo(() => {
    if (message.role !== "assistant") return null;
    const match = message.content.match(/<legal-sources\s+data="([^"]*?)"\s*\/>/);
    if (!match) return null;
    try {
      const data = JSON.parse(decodeURIComponent(match[1])) as LegalSearchResult;
      return (data.cases.length > 0 || data.offline) ? data : null;
    } catch { return null; }
  }, [message.content, message.role]);
  const effectiveLegalSources = legalSources || inlineLegalSources;
  const detectedDocType = useMemo(() => message.role === "assistant" ? detectDocumentType(cleanContent, previousUserMessage) : null, [cleanContent, message.role, previousUserMessage]);
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
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse border border-[var(--border)] text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[var(--surface)]">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-[var(--border)]">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold text-[var(--text-primary)]">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-[var(--border)] px-3 py-2 text-[var(--text-primary)]">{children}</td>
    ),
  };

  const handleCopy = () => {
    const plain = cleanContent
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{3}[\s\S]*?`{3}/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^>\s+/gm, "")
      .replace(/---/g, "")
      .trim();
    navigator.clipboard.writeText(plain);
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
              className="min-h-[96px] w-full resize-y rounded-[20px] bg-[var(--user-bubble)] px-4 py-3 text-sm leading-[1.6] text-[var(--user-bubble-text)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--text-muted)]"
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
    <div className={`message animate-message-in mb-10 w-full max-w-4xl text-left text-sm leading-[1.75] text-[var(--text-primary)] ${(message as unknown as { agentMode?: boolean }).agentMode ? "rounded-lg bg-[var(--surface)] p-4" : ""}`}>
      {message.role === "assistant" ? (
        <div className="w-full">
          <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_3px_9px_rgba(15,23,42,0.03)] px-4 py-3">
            {(message as unknown as { agentMode?: boolean }).agentMode && (
              <div className="flex items-center gap-1.5 mb-3">
                <Zap width={24} height={24} className="text-amber-400 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-[var(--text-muted)]">Lex Agent</span>
              </div>
            )}
            <div className="min-w-0 font-serif text-[15px] leading-[1.75] text-[var(--text-primary)]">
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
            {showThinking && (
              <ThinkingBar
                visible
                activeModelLabel={getInlineModelLabel(activeModel)}
                isActive={isCurrentlyStreaming}
              />
            )}
            <div className="prose prose-sm max-w-none text-[15px] leading-[1.75] transition-opacity duration-300 prose-p:my-3 prose-pre:rounded-[var(--radius-sm)] prose-pre:bg-[var(--surface-muted)] prose-pre:p-3 prose-code:rounded-[var(--radius-sm)] prose-code:bg-[var(--surface-muted)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[var(--text-primary)] prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline">
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{cleanContent}</Markdown>
            </div>
            {!isCurrentlyStreaming && docxCalls.length > 0 && (
              <div className="mt-2">
                {docxCalls.map((call, idx) => (
                  <DocxDownloadButton key={`${message.id}-docx-${idx}`} params={call} />
                ))}
              </div>
            )}
            {!isCurrentlyStreaming && detectedDocType && docxCalls.length === 0 && (
              <DocumentArtifactButton content={cleanContent} docType={detectedDocType} />
            )}
            {webSearchUsed && sourceFooterDomains.length > 0 && (
              <SourcesFooter domains={sourceFooterDomains} urls={searchUrls} />
            )}
            {!isCurrentlyStreaming && (effectiveLegalSources || isSearchingLegal) && (
              <div className="animate-fade-in">
                <LegalSourcesPanel
                  searchResult={effectiveLegalSources || null}
                  isLoading={isSearchingLegal && !effectiveLegalSources || false}
                />
              </div>
            )}
            {!isCurrentlyStreaming && <CitationsPanel content={cleanContent} attachedDocuments={message.attachedDocuments} />}
            <div className="message-actions pt-1 text-left text-[11px] text-[var(--text-tertiary)]">
              {timestamp && <div>{timestamp}</div>}
              {documentAnalyzed.map((match) => (
                <div key={match[1]} className="flex items-center gap-1">
                  <IconFileText className="h-3.5 w-3.5 text-[var(--text-muted)]" stroke={1.8} />
                  <span>{match[1]} analyzed</span>
                </div>
              ))}
            </div>
            <div className="message-actions flex h-[28px] items-center gap-3 pt-2 text-[var(--text-muted)]">
              {!isLoading && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-[28px] w-[28px] items-center justify-center transition-[color,background-color] duration-150 hover:text-[var(--text)]"
                  aria-label="Copy response"
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {!isLoading && (
                <ExportButtons content={cleanContent} messageId={message.id} />
              )}
              {!isLoading && isLast && (
                <button
                  type="button"
                  onClick={() => reload()}
                  className="flex h-[28px] w-[28px] items-center justify-center transition-[color,background-color] duration-150 hover:text-[var(--text)]"
                  aria-label="Regenerate response"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
  prevProps.previousUserMessage === nextProps.previousUserMessage &&
  prevProps.message.content === nextProps.message.content &&
  prevProps.message.id === nextProps.message.id
);
