"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import { formatBytes } from "@/lib/local-documents";
import {
  Matter,
  MatterLinks,
  readMatterLinks,
  readMatters,
  writeMatterLinks,
} from "@/lib/matters";
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
  const documents = useLocalVaultStore((state) => state.documents);
  const chats = useChatStore((state) => state.chats);

  useEffect(() => {
    const matters = readMatters();
    setMatter(matters.find((item) => item.id === params.id) || null);
    setLinks(readMatterLinks(params.id));
  }, [params.id]);

  const linkedDocuments = useMemo(
    () => documents.filter((doc) => links.documents.includes(doc.id)),
    [documents, links.documents]
  );
  const linkedChats = links.chats.map((chatId) => chats[chatId]).filter(Boolean);

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
          linkedChats.length === 0 ? (
            <MatterEmptyState
              title="No conversations linked to this matter"
              button="Start a new chat"
              onClick={() => {
                const chatId = generateUUID();
                persistLinks({ ...links, chats: Array.from(new Set([...links.chats, chatId])) });
                router.push(`/c/${chatId}?matter=${matter.id}`);
              }}
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
          )
        )}

        {activeTab === "scans" && (
          links.scans.length === 0 ? (
            <MatterEmptyState
              title="No contract scans for this matter"
              button="Scan a contract"
              onClick={() => router.push(`/contract-scanner?matter=${matter.id}`)}
            />
          ) : (
            <div className="grid gap-3">
              {links.scans.map((scanId) => (
                <div key={scanId} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4">
                  <div className="text-sm font-medium text-[var(--text)]">Contract scan</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">Risk level pending · {scanId}</div>
                </div>
              ))}
            </div>
          )
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
    </main>
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
