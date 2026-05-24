"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  Trash2,
} from "lucide-react";
import type { LocalDocument, LocalProject } from "@/lib/local-documents";
import { formatBytes } from "@/lib/local-documents";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DocFileIcon({ fileType }: { fileType: string | null }) {
  if (fileType === "pdf") {
    return <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />;
  }
  return <File className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />;
}

interface FileDirectoryProps {
  standaloneDocs: LocalDocument[];
  directoryProjects: LocalProject[];
  allDocuments: LocalDocument[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  allowMultiple?: boolean;
  forceExpanded?: boolean;
  emptyMessage?: string;
  heading?: string;
  onDelete?: (ids: string[]) => void;
}

export function FileDirectory({
  standaloneDocs,
  directoryProjects,
  allDocuments,
  selectedIds,
  onChange,
  allowMultiple = true,
  forceExpanded = false,
  emptyMessage = "No documents yet",
  heading = "Documents",
  onDelete,
}: FileDirectoryProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const docsById = new Map(allDocuments.map((doc) => [doc.id, doc]));
  const projectRows = directoryProjects.map((project) => ({
    project,
    documents: project.documentIds
      .map((id) => docsById.get(id))
      .filter((doc): doc is LocalDocument => Boolean(doc)),
  }));
  const allDocs = [...standaloneDocs, ...projectRows.flatMap((row) => row.documents)];
  const selectedCount = selectedIds.size;
  const allStandaloneSelected =
    standaloneDocs.length > 0 && standaloneDocs.every((doc) => selectedIds.has(doc.id));

  const toggle = (docId: string) => {
    if (!allowMultiple) {
      onChange(new Set([docId]));
      return;
    }
    const next = new Set(selectedIds);
    next.has(docId) ? next.delete(docId) : next.add(docId);
    onChange(next);
  };

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allStandaloneSelected) {
      standaloneDocs.forEach((doc) => next.delete(doc.id));
    } else {
      standaloneDocs.forEach((doc) => next.add(doc.id));
    }
    onChange(next);
  };

  const toggleFolder = (projectId: string) => {
    if (forceExpanded) return;
    setExpandedProjects((current) => {
      const next = new Set(current);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  if (allDocs.length === 0 && directoryProjects.length === 0) {
    return <p className="py-8 text-center text-[28px] font-normal text-[var(--text)]">{emptyMessage}</p>;
  }

  const renderDoc = (doc: LocalDocument) => {
    const selected = selectedIds.has(doc.id);
    return (
      <button
        key={doc.id}
        type="button"
        onClick={() => toggle(doc.id)}
        className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-[var(--text)] transition-colors hover:bg-[var(--sidebar-bg)]"
      >
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
            selected ? "border-[var(--text)] bg-[var(--text)]" : "border-[var(--border)]"
          }`}
        >
          {selected && <Check className="h-2.5 w-2.5 text-[var(--white)]" />}
        </span>
        <DocFileIcon fileType={doc.fileType} />
        <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
        <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
          {formatBytes(doc.sizeBytes)}
        </span>
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-sm border border-[var(--border)]">
      {(standaloneDocs.length > 0 || (onDelete && selectedCount > 0)) && (
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"
          >
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                allStandaloneSelected
                  ? "border-[var(--text)] bg-[var(--text)]"
                  : "border-[var(--border)]"
              }`}
            >
              {allStandaloneSelected && <Check className="h-2.5 w-2.5 text-[var(--white)]" />}
            </span>
            {heading}
          </button>
          {onDelete && selectedCount > 0 && (
            <button
              type="button"
              onClick={() => onDelete(Array.from(selectedIds))}
              className="flex items-center gap-1 text-xs text-[var(--danger)] hover:text-[var(--danger-hover)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
      {standaloneDocs.map(renderDoc)}
      {projectRows.map(({ project, documents }) => {
        const expanded = forceExpanded || expandedProjects.has(project.id);
        return (
          <div key={project.id}>
            <button
              type="button"
              onClick={() => toggleFolder(project.id)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--sidebar-bg)]"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Folder className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <span className="text-[11px] text-[var(--text-faint)]">{documents.length}</span>
            </button>
            {expanded && (
              <div className="pl-5">
                {documents.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-[var(--text-faint)]" style={{ fontFamily: "var(--font-body)" }}>No documents</p>
                ) : (
                  documents.map(renderDoc)
                )}
              </div>
            )}
          </div>
        );
      })}
      {allDocs.length > 0 && (
        <div className="border-t border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-faint)]">
          {allDocs.length} document{allDocs.length === 1 ? "" : "s"} · Updated{" "}
          {formatDate(allDocs[0]?.createdAt ?? new Date().toISOString())}
        </div>
      )}
    </div>
  );
}
