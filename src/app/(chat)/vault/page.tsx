"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FolderOpen, MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { HeaderSearchBtn } from "@/components/shared/header-search-btn";
import { NewVaultModal } from "@/components/vault/new-vault-modal";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { useReturnDocumentsToComposer } from "@/components/vault/vault-route-bridge";
import { getRiskCounts } from "@/lib/contract-scanner";
import { formatBytes, LocalDocument } from "@/lib/local-documents";
import { getFixedDropdownPosition, type DropdownPosition } from "@/lib/dropdown-position";
import {
  parseScanReportContent,
  type ScanReportEntry,
} from "@/lib/scan-reports";

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[300px] shrink-0";

export default function VaultPage() {
  const [search, setSearch] = useState("");
  const [newVaultOpen, setNewVaultOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<DropdownPosition | null>(null);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [scanReports, setScanReports] = useState<ScanReportEntry[]>([]);
  const [scanReportCount, setScanReportCount] = useState(0);
  const [openReportMenuId, setOpenReportMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const documents = useLocalVaultStore((state) => state.documents);
  const projects = useLocalVaultStore((state) => state.projects);
  const attachDocumentsToProject = useLocalVaultStore((state) => state.attachDocumentsToProject);
  const deleteDocument = useLocalVaultStore((state) => state.deleteDocument);
  const deleteProject = useLocalVaultStore((state) => state.deleteProject);
  const renameProject = useLocalVaultStore((state) => state.renameProject);
  const returnDocumentsToComposer = useReturnDocumentsToComposer();
  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter((project) => !q || project.name.toLowerCase().includes(q));
  }, [projects, search]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedDocuments = selectedProject
    ? documents.filter((doc) => selectedProject.documentIds.includes(doc.id))
    : [];
  const renameProjectTarget = projects.find((project) => project.id === renameProjectId) || null;
  const deleteProjectTarget = projects.find((project) => project.id === deleteProjectId) || null;
  const deleteDocumentTarget = documents.find((document) => document.id === deleteDocumentId) || null;

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-vault-actions]")) {
        return;
      }
      setOpenMenuId(null);
      setOpenReportMenuId(null);
    };
    document.addEventListener("click", closeMenus);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const loadScanReports = () => {
      fetch("/api/scan-reports")
        .then((response) => (response.ok ? response.json() : { reports: [] }))
        .then((data: { reports?: ScanReportEntry[]; count?: number }) => {
          setScanReports(Array.isArray(data.reports) ? data.reports : []);
          setScanReportCount(typeof data.count === "number" ? data.count : data.reports?.length || 0);
        })
        .catch(() => {
          setScanReports([]);
          setScanReportCount(0);
        });
    };

    loadScanReports();
    window.addEventListener("vaultr-scan-reports-updated", loadScanReports);

    return () => {
      window.removeEventListener("vaultr-scan-reports-updated", loadScanReports);
    };
  }, []);

  const deleteScanReport = async (id: string) => {
    await fetch(`/api/scan-reports?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setScanReports((reports) => reports.filter((report) => report.id !== id));
    setOpenReportMenuId(null);
  };

  const exportScanReportPdf = (report: ScanReportEntry) => {
    const analysis = parseScanReportContent(report);
    const printable = window.open("", "_blank");
    if (!printable) return;
    const clauses = analysis?.clauses || [];
    printable.document.write(`
      <html>
        <head><title>${report.title}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>${report.title}</h1>
          <p>${formatReportDate(report.date)} · ${getReportRiskSummary(report)}</p>
          ${clauses.map((clause) => `<h2>${clause.title || "Clause"}</h2><p><strong>${clause.risk || "Risk"}</strong></p><p>${clause.issue || ""}</p>`).join("")}
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
    setOpenReportMenuId(null);
  };

  return (
    <main className="h-screen flex-1 overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-start justify-between px-6 pb-6 pt-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--text)]">
            {selectedProject ? selectedProject.name : "Vault"}
          </h1>
          {!selectedProject && (
            <p className="mt-2 max-w-[620px] text-sm leading-[1.6] text-[var(--text-muted)]">
              Store and organise your contracts, scan reports, and legal documents. Everything saved here is private to your device.
            </p>
          )}
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
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg-primary)] transition-colors hover:opacity-80"
            onClick={() => {
              if (selectedProject) {
                fileInputRef.current?.click();
              } else {
                setNewVaultOpen(true);
              }
            }}
            aria-label={selectedProject ? "Add documents" : "Create vault"}
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
          onAttach={(ids) => returnDocumentsToComposer(ids, "/")}
          onDelete={setDeleteDocumentId}
          onScan={(docId) => router.push(`/contract-scanner?document=${docId}`)}
          fileInputRef={fileInputRef}
        />
      ) : (
        <>
          <div className="w-full overflow-visible">
            <div className="min-w-max">
              <div className="flex h-8 items-center border-b border-[var(--border)] pr-8 text-xs font-medium text-[var(--text-muted)] select-none">
                <div className={`sticky left-0 z-[60] ${CHECK_W} relative flex self-stretch items-center justify-center bg-[var(--bg)] before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-[var(--bg)]`} />
                <div className={`sticky left-8 z-[60] ${NAME_COL_W} bg-[var(--bg)] pl-2 text-left`}>
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
                        <div className={`sticky left-0 z-[60] ${CHECK_W} relative flex self-stretch items-center justify-center bg-[var(--bg)]`} />
                        <div className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center gap-2 bg-[var(--bg)] pl-2 text-left`}>
                          <FolderOpen className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                          <span className="truncate font-medium text-[var(--text)]">{project.name}</span>
                        </div>
                        <div className="ml-auto w-32 shrink-0 text-left">{project.cmNumber || "—"}</div>
                        <div className="w-24 shrink-0 text-left">{files.length}</div>
                        <div className="w-24 shrink-0 text-left">0</div>
                        <div className="w-36 shrink-0 text-left">{scanReportCount}</div>
                        <div className="w-32 shrink-0 text-left">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                        <div className="relative flex w-8 shrink-0 justify-center" data-vault-actions>
                          <button
                            type="button"
                            className="rounded-[var(--radius-sm)] p-1 text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (openMenuId === project.id) {
                                setOpenMenuId(null);
                                setMenuPosition(null);
                                return;
                              }
                              setMenuPosition(getFixedDropdownPosition(event.currentTarget, 120, 116));
                              setOpenMenuId(project.id);
                            }}
                            aria-label={`${project.name} actions`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenuId === project.id && (
                            <ActionMenu
                              onClose={() => setOpenMenuId(null)}
                              position={menuPosition}
                              items={[
                                { label: "Open", onClick: () => setSelectedProjectId(project.id) },
                                {
                                  label: "Rename",
                                  onClick: () => setRenameProjectId(project.id),
                                },
                                {
                                  label: "Delete",
                                  destructive: true,
                                  onClick: () => setDeleteProjectId(project.id),
                                },
                              ]}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-xs flex-col items-start py-24">
                  <FolderOpen className="mb-4 h-8 w-8 text-[var(--text-faint)]" />
                  <p className="text-[28px] font-normal text-[var(--text)]">
                    Vault
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-[var(--text-faint)]">
                    Store and organise your contracts, scan reports, and legal documents. Everything saved here is private to your device.
                  </p>
                  <button
                    type="button"
                    onClick={() => setNewVaultOpen(true)}
                    className="mt-4 inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--bg-primary)] shadow-md transition-colors hover:opacity-80"
                  >
                    + Create New
                  </button>
                </div>
              )}
            </div>
          </div>
          <ScanReportsSection
            reports={scanReports}
            onViewReport={(id) => router.push(`/contract-scanner?report=${id}`)}
            openMenuId={openReportMenuId}
            onToggleMenu={setOpenReportMenuId}
            onDelete={deleteScanReport}
            onExportPdf={exportScanReportPdf}
          />
        </>
      )}
      {renameProjectTarget && (
        <RenameVaultModal
          name={renameProjectTarget.name}
          onClose={() => setRenameProjectId(null)}
          onSave={(name) => {
            renameProject(renameProjectTarget.id, name);
            setRenameProjectId(null);
          }}
        />
      )}
      {deleteProjectTarget && (
        <ConfirmDeleteModal
          name={deleteProjectTarget.name}
          onClose={() => setDeleteProjectId(null)}
          onDelete={() => {
            deleteProject(deleteProjectTarget.id);
            setDeleteProjectId(null);
            if (selectedProjectId === deleteProjectTarget.id) setSelectedProjectId(null);
          }}
        />
      )}
      {deleteDocumentTarget && (
        <ConfirmDeleteModal
          name={deleteDocumentTarget.filename}
          onClose={() => setDeleteDocumentId(null)}
          onDelete={() => {
            deleteDocument(deleteDocumentTarget.id);
            setDeleteDocumentId(null);
          }}
        />
      )}
      <NewVaultModal open={newVaultOpen} onClose={() => setNewVaultOpen(false)} />
    </main>
  );
}

function formatReportDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getReportRiskSummary(report: ScanReportEntry) {
  if (
    typeof report.highCount === "number" &&
    typeof report.mediumCount === "number" &&
    typeof report.standardCount === "number"
  ) {
    return `${report.highCount} High · ${report.mediumCount} Medium · ${report.standardCount} Standard`;
  }

  const analysis = parseScanReportContent(report);
  if (!analysis) return "Risk summary unavailable";

  const counts = getRiskCounts(analysis.clauses);
  return `${counts.high} High · ${counts.medium} Medium · ${counts.standard} Standard`;
}

function getReportClauseCount(report: ScanReportEntry) {
  const analysis = parseScanReportContent(report);
  return Array.isArray(analysis?.clauses) ? analysis.clauses.length : 0;
}

function getOverallRiskLevel(report: ScanReportEntry) {
  if ((report.highCount || 0) > 0) return "High risk";
  if ((report.mediumCount || 0) > 0) return "Medium risk";
  return "Standard risk";
}

function ScanReportsSection({
  reports,
  onViewReport,
  openMenuId,
  onToggleMenu,
  onDelete,
  onExportPdf,
}: {
  reports: ScanReportEntry[];
  onViewReport: (id: string) => void;
  openMenuId: string | null;
  onToggleMenu: (id: string | null) => void;
  onDelete: (id: string) => void;
  onExportPdf: (report: ScanReportEntry) => void;
}) {
  if (reports.length === 0) return null;

  return (
    <section className="px-8 pb-10 pt-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[28px] font-normal text-[var(--text)]">
            Scan Reports
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Contract Scanner reports saved automatically after each scan.
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        {reports.map((report) => (
          <article
            key={report.id}
            className="flex cursor-pointer items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-5 py-4 transition-colors hover:bg-[var(--sidebar-bg)]"
            role="button"
            tabIndex={0}
            onClick={() => onViewReport(report.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onViewReport(report.id);
            }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--text-muted)]">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[22px] font-normal text-[var(--text)]">
                {report.title}
              </h3>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {report.filename || report.title} · {formatReportDate(report.date)} · {getOverallRiskLevel(report)} · {getReportClauseCount(report)} clauses · {getReportRiskSummary(report)}
              </div>
            </div>
            <div className="relative" data-vault-actions>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleMenu(openMenuId === report.id ? null : report.id);
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                Actions
              </button>
              {openMenuId === report.id && (
                <div className="absolute right-0 top-10 z-10 min-w-[160px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_4px_12px_var(--shadow-soft)]">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onViewReport(report.id); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
                    View Report
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onExportPdf(report); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
                    Export as PDF
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(report.id); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface)]">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VaultDetail({
  documents,
  onAddDocuments,
  onAttach,
  onDelete,
  onScan,
  fileInputRef,
}: {
  projectId: string;
  documents: LocalDocument[];
  onAddDocuments: (files: File[]) => void;
  onAttach: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onScan: (id: string) => void;
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
          <p className="mt-3 text-[28px] font-normal text-[var(--text)]">No documents yet</p>
          <p className="mt-1 text-[13px] text-[var(--text-faint)]">
            Add documents to get started
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80"
          >
            + Add Documents
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80"
            >
              + Add Documents
            </button>
          </div>
          <div className="grid gap-3">
            {documents.map((doc) => (
              <VaultDocumentCard
                key={doc.id}
                document={doc}
                onAttach={() => onAttach([doc.id])}
                onDelete={() => onDelete(doc.id)}
                onScan={() => onScan(doc.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function VaultDocumentCard({
  document,
  onAttach,
  onDelete,
  onScan,
}: {
  document: LocalDocument;
  onAttach: () => void;
  onDelete: () => void;
  onScan: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const type = document.fileType?.toUpperCase() || "FILE";
  const iconColor =
    document.fileType === "pdf"
      ? "text-[var(--danger-hover)] bg-[var(--danger-bg)]"
      : document.fileType === "docx" || document.fileType === "doc"
      ? "text-[var(--blue)] bg-[var(--bg-tertiary)]"
      : "text-[var(--text-muted)] bg-[var(--surface)]";

  return (
    <article className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-5 py-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${iconColor}`}>
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--text)]">
          {document.filename}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {formatBytes(document.sizeBytes)} · Uploaded {new Date(document.createdAt).toLocaleDateString()} · {type}
        </div>
      </div>
      <button
        type="button"
        onClick={onAttach}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
      >
        Attach to Lex
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          aria-label={`${document.filename} actions`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-10 min-w-[180px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_4px_12px_var(--shadow-soft)]">
            <button type="button" onClick={onScan} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
              Send to Contract Scanner
            </button>
            <button type="button" className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
              Download
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface)]"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function RenameVaultModal({
  name,
  onClose,
  onSave,
}: {
  name: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <form
        className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text-primary)] shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const nextName = draft.trim();
          if (nextName) onSave(nextName);
        }}
      >
        <h2 className="text-[28px] font-normal">Rename Vault</h2>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          className="mt-5 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
            Cancel
          </button>
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--bg-primary)] hover:opacity-90">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <div
        className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text-primary)] shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[28px] font-normal">Delete {name}?</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">This cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
            Cancel
          </button>
          <button type="button" onClick={onDelete} className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2 text-[13px] font-medium text-[var(--white)] hover:bg-[var(--danger-hover)]">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionMenu({
  items,
  onClose,
  position,
}: {
  items: { label: string; destructive?: boolean; onClick: () => void }[];
  onClose: () => void;
  position: DropdownPosition | null;
}) {
  return (
    <div
      className="fixed z-50 min-w-[120px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_4px_12px_var(--shadow-soft)]"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface)] ${
            item.destructive ? "text-[var(--danger)]" : "text-[var(--text)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
