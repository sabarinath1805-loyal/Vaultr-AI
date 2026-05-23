"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { FileDirectory } from "@/components/shared/file-directory";
import useLocalVaultStore, { rehydrateLocalVaultSafely } from "@/app/hooks/useLocalVaultStore";
import { selectTauriDocumentFiles } from "@/lib/tauri-client";

interface NewVaultModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewVaultModal({ open, onClose }: NewVaultModalProps) {
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const addDocuments = useLocalVaultStore((state) => state.addDocuments);
  const createProject = useLocalVaultStore((state) => state.createProject);
  const [name, setName] = useState("");
  const [cmNumber, setCmNumber] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCmNumber("");
    setSelectedDocIds(new Set());
    setPendingFiles([]);
    rehydrateLocalVaultSafely();
  }, [open]);

  if (!open) return null;

  const openFilePicker = async () => {
    const tauriPaths = await selectTauriDocumentFiles().catch(() => null);
    if (tauriPaths) {
      if (tauriPaths.length > 0) {
        setPendingFiles(tauriPaths);
      }
      return;
    }

    fileInputRef.current?.click();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    const uploaded = pendingFiles.length ? addDocuments(pendingFiles) : [];
    createProject(name.trim(), cmNumber.trim() || null, [
      ...Array.from(selectedDocIds),
      ...uploaded.map((doc) => doc.id),
    ]);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-[1px]">
      <div className="flex h-[600px] w-full max-w-2xl flex-col rounded-2xl bg-[var(--bg)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <span>Vault</span>
            <span>›</span>
            <span>Create New</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
            aria-label="Close create vault"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Vault name"
              className="w-full bg-transparent text-[28px] font-normal text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
              autoFocus
            />
            <input
              type="text"
              value={cmNumber}
              onChange={(event) => setCmNumber(event.target.value)}
              placeholder="Matter reference (optional)"
              className="mt-1.5 w-full bg-transparent text-sm text-[var(--text-muted)] outline-none placeholder:text-[var(--text-faint)]"
            />

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-[var(--text)]">Select documents</p>
              <FileDirectory
                standaloneDocs={documents.filter((doc) => !doc.projectId)}
                directoryProjects={projects}
                allDocuments={documents}
                selectedIds={selectedDocIds}
                onChange={setSelectedDocIds}
                emptyMessage="No existing documents"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
              />
              <button
                type="button"
                onClick={openFilePicker}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--sidebar-bg)]"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload files{pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ""}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:opacity-80 disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
