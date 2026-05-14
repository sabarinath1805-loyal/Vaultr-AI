"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, FolderOpen, MoreHorizontal, Plus } from "lucide-react";
import { HeaderSearchBtn } from "@/components/shared/header-search-btn";
import { ToolbarTabs } from "@/components/shared/toolbar-tabs";
import { NewVaultModal } from "@/components/vault/new-vault-modal";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { useReturnDocumentsToComposer } from "@/components/vault/vault-route-bridge";

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[300px] shrink-0";

type Tab = "all" | "mine" | "shared-with-me";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "shared-with-me", label: "Shared with me" },
];

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [newVaultOpen, setNewVaultOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const attachDocumentsToProject = useLocalVaultStore((state) => state.attachDocumentsToProject);
  const returnDocumentsToComposer = useReturnDocumentsToComposer();
  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter((project) => !q || project.name.toLowerCase().includes(q));
  }, [projects, search]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedDocuments = selectedProject
    ? documents.filter((doc) => selectedProject.documentIds.includes(doc.id))
    : [];

  return (
    <main className="h-screen flex-1 overflow-y-auto bg-white">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="font-display text-2xl font-medium text-[var(--text)]">
            {selectedProject ? selectedProject.name : "Vault"}
          </h1>
          {selectedProject && (
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="mt-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              ← Back to Vault
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!selectedProject && (
            <HeaderSearchBtn
              value={search}
              onChange={setSearch}
              placeholder="Search vault..."
            />
          )}
          <button
            type="button"
            className="flex items-center justify-center p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            onClick={() => setNewVaultOpen(true)}
            aria-label="Create vault"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedProject ? (
        <VaultDetail
          projectId={selectedProject.id}
          documents={selectedDocuments}
          onAddDocuments={(files) => attachDocumentsToProject(selectedProject.id, files)}
          onAttach={(ids) => returnDocumentsToComposer(ids)}
          fileInputRef={fileInputRef}
        />
      ) : (
        <>
          <ToolbarTabs
            tabs={tabs}
            active={activeTab}
            onChange={setActiveTab}
            actions={
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            }
          />

          <div className="w-full overflow-x-auto">
            <div className="min-w-max">
              <div className="flex h-8 items-center border-b border-[var(--border)] pr-8 text-xs font-medium text-[var(--text-muted)] select-none">
                <div className={`sticky left-0 z-[60] ${CHECK_W} relative flex self-stretch items-center justify-center bg-white before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-white`} />
                <div className={`sticky left-8 z-[60] ${NAME_COL_W} bg-white pl-2 text-left`}>
                  Name
                </div>
                <div className="ml-auto w-32 shrink-0 text-left">CM</div>
                <div className="w-24 shrink-0 text-left">Files</div>
                <div className="w-24 shrink-0 text-left">Chats</div>
                <div className="w-36 shrink-0 text-left">Contract Scans</div>
                <div className="w-32 shrink-0 text-left">Created</div>
                <div className="w-8 shrink-0" />
              </div>

              {rows.length > 0 ? (
                <div>
                  {rows.map((project) => {
                    const files = documents.filter((doc) => project.documentIds.includes(doc.id));
                    return (
                      <div
                        key={project.id}
                        className="flex h-11 cursor-pointer items-center border-b border-[var(--border)] pr-8 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--sidebar-bg)]"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProjectId(project.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setSelectedProjectId(project.id);
                        }}
                      >
                        <div className={`sticky left-0 z-[60] ${CHECK_W} relative flex self-stretch items-center justify-center bg-white`} />
                        <div className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center gap-2 bg-white pl-2 text-left`}>
                          <FolderOpen className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                          <span className="truncate font-medium text-[var(--text)]">{project.name}</span>
                        </div>
                        <div className="ml-auto w-32 shrink-0 text-left">{project.cmNumber || "—"}</div>
                        <div className="w-24 shrink-0 text-left">{files.length}</div>
                        <div className="w-24 shrink-0 text-left">0</div>
                        <div className="w-36 shrink-0 text-left">0</div>
                        <div className="w-32 shrink-0 text-left">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                        <button
                          type="button"
                          className="flex w-8 shrink-0 justify-center text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            returnDocumentsToComposer(project.documentIds);
                          }}
                          title="Attach vault documents to composer"
                          aria-label={`Attach ${project.name} documents`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-xs flex-col items-start py-24">
                  <FolderOpen className="mb-4 h-8 w-8 text-[var(--text-faint)]" />
                  <p className="font-display text-2xl font-medium text-[var(--text)]">
                    Vault
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-[var(--text-faint)]">
                    Upload documents into the vault and commence chats and contract scans with them.
                  </p>
                  <button
                    type="button"
                    onClick={() => setNewVaultOpen(true)}
                    className="mt-4 inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-[rgb(51,51,51)]"
                  >
                    + Create New
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <NewVaultModal open={newVaultOpen} onClose={() => setNewVaultOpen(false)} />
    </main>
  );
}

function VaultDetail({
  documents,
  onAddDocuments,
  onAttach,
  fileInputRef,
}: {
  projectId: string;
  documents: { id: string; filename: string }[];
  onAddDocuments: (files: File[]) => void;
  onAttach: (ids: string[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <section className="px-8 pt-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length > 0) onAddDocuments(files);
          event.target.value = "";
        }}
      />
      {documents.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-center">
          <FolderOpen className="h-8 w-8 text-[var(--text-faint)]" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">No documents yet</p>
          <p className="mt-1 text-[13px] text-[var(--text-faint)]">
            Add documents to get started
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-white transition-colors hover:bg-[#333]"
          >
            + Add Documents
          </button>
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-[13px] last:border-b-0"
            >
              <span className="font-medium text-[var(--text)]">{doc.filename}</span>
              <button
                type="button"
                onClick={() => onAttach([doc.id])}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Attach to Assistant
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
