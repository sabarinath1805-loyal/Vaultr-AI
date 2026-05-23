"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import { formatBytes } from "@/lib/local-documents";
import { getRiskCounts } from "@/lib/contract-scanner";
import {
  Matter,
  MatterLinks,
  readMatterLinks,
  readMatters,
  writeMatterLinks,
} from "@/lib/matters";
import { parseScanReportContent, type ScanReportEntry } from "@/lib/scan-reports";
import { generateUUID } from "@/lib/utils";

type Tab = "documents" | "chats" | "scans";

const tabs: { id: Tab; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "chats", label: "Chats" },
  { id: "scans", label: "Contract Scans" },
];

export default function MatterDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [matter, setMatter] = useState<Matter | null>(null);
  const [links, setLinks] = useState<MatterLinks>({ documents: [], chats: [], scans: [] });
  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [scanPickerOpen, setScanPickerOpen] = useState(false);
  const [scanReports, setScanReports] = useState<ScanReportEntry[]>([]);
  const documents = useLocalVaultStore((state) => state.documents);
  const chats = useChatStore((state) => state.chats);
  const loadChats = useChatStore((state) => state.loadChats);

  useEffect(() => {
    const matters = readMatters();
    setMatter(matters.find((item) => item.id === params.id) || null);
    setLinks(readMatterLinks(params.id));
  }, [params.id]);

  useEffect(() => {
    loadChats().catch(() => undefined);
    fetch("/api/scan-reports", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { reports: [] }))
      .then((data: { reports?: ScanReportEntry[] }) => {
        setScanReports(Array.isArray(data.reports) ? data.reports : []);
      })
      .catch(() => setScanReports([]));
  }, [loadChats]);

  const linkedDocuments = useMemo(
    () => documents.filter((doc) => links.documents.includes(doc.id)),
    [documents, links.documents]
  );
  const linkedChats = links.chats.map((chatId) => chats[chatId]).filter(Boolean);
  const linkedScans = links.scans
    .map((scanId) => scanReports.find((report) => report.id === scanId))
    .filter((report): report is ScanReportEntry => Boolean(report));

  const persistLinks = (next: MatterLinks) => {
    setLinks(next);
    writeMatterLinks(params.id, next);
  };

  if (!matter) {
    return (
      <main className="h-screen bg-[var(--bg)] p-8 text-sm text-[var(--text-muted)]">
        Matter not found.
      </main>
    );
  }

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)] px-8 py-6">
      <button
        type="button"
        onClick={() => router.push("/matters")}
        className="text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← Back to Matters
      </button>

      <header className="mt-6">
        <h1 className="text-[28px] font-normal text-[var(--text)]">
          {matter.name}
        </h1>
        <div className="mt-2 text-[13px] text-[var(--text-muted)]">
          {[matter.client || "No client", matter.type, matter.status, new Date(matter.createdAt).toLocaleDateString()].join(" · ")}
        </div>
      </header>

      <div className="mt-8 flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-3 text-[13px] transition-colors ${
              activeTab === tab.id
                ? "border-[var(--text)] font-medium text-[var(--text)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="py-8">
        {activeTab === "documents" && (
          linkedDocuments.length === 0 ? (
            <MatterEmptyState
              icon={<FolderOpen className="h-8 w-8 text-[var(--text-faint)]" />}
              title="No documents linked to this matter"
              button="Link from Vault"
              onClick={() => setDocumentPickerOpen(true)}
            />
          ) : (
            <div className="grid gap-3">
              {linkedDocuments.map((doc) => (
                <div key={doc.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4">
                  <div className="text-sm font-medium text-[var(--text)]">{doc.filename}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatBytes(doc.sizeBytes)} · Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "chats" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const chatId = generateUUID();
                  persistLinks({ ...links, chats: Array.from(new Set([...links.chats, chatId])) });
                  router.push(`/c/${chatId}?matter=${matter.id}`);
                }}
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80"
              >
                Start new chat
              </button>
              <button
                type="button"
                onClick={() => setChatPickerOpen(true)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                Link existing chat
              </button>
            </div>
            {linkedChats.length === 0 ? (
              <MatterEmptyState
                title="No conversations linked to this matter"
                button="Link existing chat"
                onClick={() => setChatPickerOpen(true)}
              />
            ) : (
              <div className="grid gap-2">
                {linkedChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => router.push(`/c/${chat.id}`)}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 text-left hover:bg-[var(--sidebar-bg)]"
                  >
                    <div className="text-sm font-medium text-[var(--text)]">{chat.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "scans" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/contract-scanner?matter=${matter.id}`)}
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80"
              >
                Scan a contract
              </button>
              <button
                type="button"
                onClick={() => setScanPickerOpen(true)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                Link existing scan
              </button>
            </div>
            {linkedScans.length === 0 ? (
              <MatterEmptyState
                title="No contract scans for this matter"
                button="Link existing scan"
                onClick={() => setScanPickerOpen(true)}
              />
            ) : (
              <div className="grid gap-3">
                {linkedScans.map((scan) => {
                  const analysis = parseScanReportContent(scan);
                  const counts = getRiskCounts(analysis?.clauses || []);
                  return (
                    <button
                      key={scan.id}
                      type="button"
                      onClick={() => router.push(`/contract-scanner?report=${encodeURIComponent(scan.id)}`)}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4 text-left hover:bg-[var(--sidebar-bg)]"
                    >
                      <div className="text-sm font-medium text-[var(--text)]">{scan.filename}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {scan.overallRisk || analysis?.overall_risk || "Risk pending"} · {counts.high} High · {counts.medium} Medium · {counts.standard} Standard
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <AddDocumentsModal
        open={documentPickerOpen}
        onClose={() => setDocumentPickerOpen(false)}
        onSelect={(selectedDocs) => {
          persistLinks({
            ...links,
            documents: Array.from(new Set([...links.documents, ...selectedDocs.map((doc) => doc.id)])),
          });
          setDocumentPickerOpen(false);
        }}
        breadcrumb={["Matters", matter.name, "Link Documents"]}
      />
      <LinkExistingModal
        open={chatPickerOpen}
        title="Link existing chat"
        emptyMessage="No chat history found."
        onClose={() => setChatPickerOpen(false)}
      >
        {Object.values(chats).map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => {
              persistLinks({ ...links, chats: Array.from(new Set([...links.chats, chat.id])) });
              setChatPickerOpen(false);
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left hover:bg-[var(--sidebar-bg)]"
          >
            <div className="text-sm font-medium text-[var(--text)]">{chat.title}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {new Date(chat.updatedAt).toLocaleDateString()}
            </div>
          </button>
        ))}
      </LinkExistingModal>
      <LinkExistingModal
        open={scanPickerOpen}
        title="Link existing scan"
        emptyMessage="No scan reports found."
        onClose={() => setScanPickerOpen(false)}
      >
        {scanReports.map((scan) => (
          <button
            key={scan.id}
            type="button"
            onClick={() => {
              persistLinks({ ...links, scans: Array.from(new Set([...links.scans, scan.id])) });
              setScanPickerOpen(false);
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left hover:bg-[var(--sidebar-bg)]"
          >
            <div className="text-sm font-medium text-[var(--text)]">{scan.filename}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {new Date(scan.date).toLocaleDateString()} · {scan.overallRisk || "Risk pending"}
            </div>
          </button>
        ))}
      </LinkExistingModal>
    </main>
  );
}

function LinkExistingModal({
  open,
  title,
  emptyMessage,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  emptyMessage: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  const entries = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-xl overflow-hidden rounded-2xl bg-[var(--bg)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="text-base font-medium text-[var(--text)]">{title}</div>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Close</button>
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-5">
          {entries.length > 0 ? entries : <div className="py-8 text-center text-sm text-[var(--text-muted)]">{emptyMessage}</div>}
        </div>
      </div>
    </div>
  );
}

function MatterEmptyState({
  icon,
  title,
  button,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-center">
      {icon || <FileText className="h-8 w-8 text-[var(--text-faint)]" />}
      <p className="mt-3 text-sm text-[var(--text-muted)]">{title}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80"
      >
        {button}
      </button>
    </div>
  );
}
