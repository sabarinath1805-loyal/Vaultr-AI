"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { File, FileText, Loader2, Search, Upload, X } from "lucide-react";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { formatBytes, type LocalDocument } from "@/lib/local-documents";
import { FileDirectory } from "@/components/shared/file-directory";
import { selectTauriDocumentFiles } from "@/lib/tauri-client";

interface AddDocumentsModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (documents: LocalDocument[], projectId?: string) => void;
  breadcrumb: string[];
  allowMultiple?: boolean;
  projectId?: string;
  title?: string;
  describeDocument?: (document: LocalDocument) => string;
}

export function AddDocumentsModal({
  open,
  onClose,
  onSelect,
  breadcrumb,
  allowMultiple = true,
  projectId,
  title,
  describeDocument,
}: AddDocumentsModalProps) {
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const addDocuments = useLocalVaultStore((state) => state.addDocuments);
  const deleteDocuments = useLocalVaultStore((state) => state.deleteDocuments);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedIds(new Set());
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const standaloneDocs = documents.filter(
      (doc) => !doc.projectId && (!q || doc.filename.toLowerCase().includes(q))
    );
    const directoryProjects = projects
      .filter((project) => project.id !== projectId)
      .map((project) => {
        if (!q) return project;
        const documentIds = project.documentIds.filter((id) => {
          const doc = documents.find((candidate) => candidate.id === id);
          return doc?.filename.toLowerCase().includes(q);
        });
        return { ...project, documentIds };
      })
      .filter((project) => !q || project.name.toLowerCase().includes(q) || project.documentIds.length > 0);

    return { standaloneDocs, directoryProjects };
  }, [documents, projectId, projects, search]);

  if (!open) return null;

  const addUploadedFiles = (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    const uploaded = addDocuments(files, projectId ?? null);
    setSelectedIds((current) =>
      new Set([...Array.from(current), ...uploaded.map((doc) => doc.id)])
    );
    setUploading(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    addUploadedFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const openFilePicker = async () => {
    const tauriPaths = await selectTauriDocumentFiles().catch(() => null);
    if (tauriPaths) {
      addUploadedFiles(tauriPaths);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleConfirm = () => {
    const selected = useLocalVaultStore
      .getState()
      .documents.filter((doc) => selectedIds.has(doc.id));
    const projectIds = new Set(selected.map((doc) => doc.projectId).filter(Boolean));
    const projectIdValues = Array.from(projectIds);
    onSelect(selected, projectIdValues.length === 1 ? (projectIdValues[0] as string) : undefined);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-[1px]" onClick={onClose}>
      <div className="flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--bg)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <div>
            {title ? (
              <div className="text-base font-medium text-[var(--text)]">{title}</div>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
              {breadcrumb.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="contents">
                  <span>{crumb}</span>
                  {index < breadcrumb.length - 1 && <span>›</span>}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
            aria-label="Close documents"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {title ? (
              <div className="space-y-1">
                {documents.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[28px] font-normal text-[var(--text)]">No documents yet</p>
                    <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Upload documents to Vault first.</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        onSelect([doc], doc.projectId || undefined);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      {doc.fileType === "pdf" ? (
                        <FileText className="h-4 w-4 shrink-0 text-[var(--danger)]" />
                      ) : (
                        <File className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-[var(--text)]">{doc.filename}</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {describeDocument?.(doc) || formatBytes(doc.sizeBytes)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <FileDirectory
                standaloneDocs={filtered.standaloneDocs}
                directoryProjects={filtered.directoryProjects}
                allDocuments={documents}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                allowMultiple={allowMultiple}
                emptyMessage="No existing documents"
                onDelete={deleteDocuments}
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={openFilePicker}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--sidebar-bg)] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading..." : "Upload files"}
            </button>
          </div>
          {!title && <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || uploading}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:opacity-80 disabled:opacity-40"
            >
              Add {selectedIds.size || ""}
            </button>
          </div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
