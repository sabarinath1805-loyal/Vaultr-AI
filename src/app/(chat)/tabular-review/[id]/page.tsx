"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TabularReview {
  id: string;
  name: string;
  document_type?: string | null;
  columns: string[];
  document_ids: string[];
  results: { [docId: string]: { [colIndex: string]: string } };
  created_at: string;
}

interface VaultDocument {
  id: string;
  filename: string;
  fileType: string | null;
  sizeBytes: number;
  projectId: string | null;
}

const SKELETON_COLS = 4;
const SKELETON_ROWS = 5;
const COL_W = "w-[300px] shrink-0";
const DOC_COL_W = "w-[332px] shrink-0";
const DATA_COL_W_PX = 300;
const DOC_COL_W_PX = 332;

export default function TabularReviewDetailPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const router = useRouter();

  const [review, setReview] = useState<TabularReview | null>(null);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [savingColumn, setSavingColumn] = useState(false);
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(
    null
  );
  const [editingColumnName, setEditingColumnName] = useState("");
  const [columnMenuIndex, setColumnMenuIndex] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    colIndex: number;
    fullText: string;
  } | null>(null);
  const [docsPickerOpen, setDocsPickerOpen] = useState(false);

  const fetchReview = useCallback(async () => {
    try {
      const response = await fetch(`/api/tabular-review/${reviewId}`);
      if (response.ok) {
        const data = await response.json();
        setReview(data.review);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch review:", error);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const fetchDocuments = useCallback(async () => {
    if (!review) return;
    try {
      const response = await fetch("/api/local-vault");
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.documents || []).filter(
          (d: VaultDocument) => review.document_ids.includes(d.id)
        );
        setDocuments(filtered);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch documents:", error);
    }
  }, [review]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const updateReview = async (updates: Partial<TabularReview>) => {
    try {
      const response = await fetch(`/api/tabular-review/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        await fetchReview();
      }
    } catch (error) {
      console.error("[TabularReview] Failed to update review:", error);
    }
  };

  const runAll = async () => {
    if (!review) return;
    setRunning(true);
    try {
      for (const doc of documents) {
        for (let colIndex = 0; colIndex < review.columns.length; colIndex++) {
          if (review.results?.[doc.id]?.[colIndex]) continue;
          await fetch(`/api/tabular-review/${reviewId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: doc.id, columnIndex: colIndex }),
          });
        }
      }
      await fetchReview();
    } catch (error) {
      console.error("[TabularReview] Failed to run all:", error);
    } finally {
      setRunning(false);
    }
  };

  const runCell = async (documentId: string, columnIndex: number) => {
    if (!review) return;
    try {
      const response = await fetch(`/api/tabular-review/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, columnIndex }),
      });
      if (response.ok) {
        await fetchReview();
      }
    } catch (error) {
      console.error("[TabularReview] Failed to run cell:", error);
    }
  };

  const addColumnInline = async () => {
    if (!review) return;
    const next = `New column ${review.columns.length + 1}`;
    setSavingColumn(true);
    try {
      await updateReview({ columns: [...review.columns, next] });
    } finally {
      setSavingColumn(false);
    }
  };

  const saveColumnName = async (index: number, name: string) => {
    if (!review) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingColumnIndex(null);
      return;
    }
    const newColumns = [...review.columns];
    newColumns[index] = trimmed;
    setSavingColumn(true);
    try {
      await updateReview({ columns: newColumns });
    } finally {
      setSavingColumn(false);
      setEditingColumnIndex(null);
    }
  };

  const deleteColumn = async (index: number) => {
    if (!review) return;
    setColumnMenuIndex(null);
    const newColumns = review.columns.filter((_, i) => i !== index);
    await updateReview({ columns: newColumns });
  };

  const handleAttachDocuments = async (docIds: string[]) => {
    if (!review) return;
    // De-dupe and merge with existing
    const merged = Array.from(new Set([...review.document_ids, ...docIds]));
    await updateReview({ document_ids: merged });
    setDocsPickerOpen(false);
  };

  const exportCsv = () => {
    if (!review) return;
    const headers = ["Document", ...review.columns];
    const rows = documents.map((doc) => {
      const row = [doc.filename];
      for (let i = 0; i < review.columns.length; i++) {
        row.push(review.results?.[doc.id]?.[i] || "");
      }
      return row;
    });
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${review.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading skeleton
  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="h-7 w-48 rounded bg-[var(--surface-muted)] animate-pulse" />
        <div className="mt-2 h-3 w-32 rounded bg-[var(--surface-muted)] animate-pulse" />
        <div className="mt-8 flex-1 overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <div
              className={`${DOC_COL_W} flex items-center gap-4 border-r border-[var(--border)] py-2 pl-4 pr-2 text-xs font-medium text-[var(--text-muted)]`}
            >
              <div className="h-2.5 w-2.5 shrink-0 rounded bg-[var(--surface-muted)] animate-pulse" />
              <span>Document</span>
            </div>
            {Array.from({ length: SKELETON_COLS }).map((_, i) => (
              <div
                key={i}
                className={`${COL_W} border-r border-[var(--border)] p-2`}
              >
                <div className="h-4 w-28 rounded bg-[var(--surface-muted)] animate-pulse" />
              </div>
            ))}
            <div className="flex-1" />
          </div>
          {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
            <div
              key={row}
              className={`flex border-b border-[var(--border)]/50 ${
                row % 2 === 0 ? "" : "bg-[var(--surface-muted)]/40"
              }`}
            >
              <div
                className={`${DOC_COL_W} flex items-center gap-4 py-2 pl-4 pr-2`}
              >
                <div className="h-2.5 w-2.5 shrink-0 rounded bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-4 w-32 rounded bg-[var(--surface-muted)] animate-pulse" />
              </div>
              {Array.from({ length: SKELETON_COLS }).map((_, col) => (
                <div key={col} className={`${COL_W} p-2`}>
                  <div className="h-4 rounded bg-[var(--surface-muted)] animate-pulse" />
                </div>
              ))}
              <div className="flex-1" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="p-10 text-center text-[var(--text-muted)]">
          Review not found.
        </div>
      </main>
    );
  }

  const sortedColumns = [...review.columns];
  const totalContentWidth =
    DOC_COL_W_PX + sortedColumns.length * DATA_COL_W_PX + 32;

  const isEmpty = review.columns.length === 0 && documents.length === 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => router.push("/tabular-review")}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <h1 className="mt-1 truncate text-2xl font-medium text-[var(--text)]">
            {review.name}
          </h1>
          {review.document_type && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {review.document_type}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            onClick={exportCsv}
            variant="outline"
            disabled={review.columns.length === 0 || documents.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            onClick={runAll}
            disabled={running || review.columns.length === 0 || documents.length === 0}
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Run All
          </Button>
        </div>
      </div>

      {/* Toolbar: Add Columns, Add Documents, delete selected */}
      <div className="mt-6 flex items-center justify-between border-b border-[var(--border)] pb-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addColumnInline}
            disabled={savingColumn}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Column
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDocsPickerOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Add Documents
          </Button>
        </div>
        {selectedDocIds.length > 0 && (
          <button
            onClick={() => setSelectedDocIds([])}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Clear {selectedDocIds.length} selected
          </button>
        )}
      </div>

      {/* Spreadsheet */}
      {isEmpty ? (
        <div className="mt-10 flex flex-1 flex-col items-center justify-center py-20 w-full text-center">
          <Table2 className="h-8 w-8 text-[var(--text-muted)] mb-4" />
          <p
            className="text-2xl font-medium text-[var(--text)]"
            style={{
              fontFamily:
                "var(--font-instrument-serif, 'Instrument Serif', serif)",
            }}
          >
            Tabular Review
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs text-center">
            Add columns and documents to get started.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={addColumnInline} disabled={savingColumn}>
              + Add Column
            </Button>
            <Button variant="outline" onClick={() => setDocsPickerOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Add Documents
            </Button>
          </div>
        </div>
      ) : (
        <Spreadsheet
          review={review}
          documents={documents}
          selectedDocIds={selectedDocIds}
          onSelectionChange={setSelectedDocIds}
          totalContentWidth={totalContentWidth}
          editingColumnIndex={editingColumnIndex}
          setEditingColumnIndex={setEditingColumnIndex}
          editingColumnName={editingColumnName}
          setEditingColumnName={setEditingColumnName}
          columnMenuIndex={columnMenuIndex}
          setColumnMenuIndex={setColumnMenuIndex}
          savingColumn={savingColumn}
          onRunCell={runCell}
          onSaveColumnName={saveColumnName}
          onDeleteColumn={deleteColumn}
          onAddColumn={addColumnInline}
          onCellClick={(cell) => setSelectedCell(cell)}
          onAddDocuments={() => setDocsPickerOpen(true)}
        />
      )}

      {/* Cell expand modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium">
                {review.columns[selectedCell.colIndex]}
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-[var(--text)] whitespace-pre-wrap">
              {selectedCell.fullText}
            </p>
          </div>
        </div>
      )}

      <AddDocumentsDialog
        open={docsPickerOpen}
        onOpenChange={setDocsPickerOpen}
        existingDocIds={review.document_ids}
        onAttach={handleAttachDocuments}
      />
    </main>
  );
}

interface SpreadsheetProps {
  review: TabularReview;
  documents: VaultDocument[];
  selectedDocIds: string[];
  onSelectionChange: (ids: string[]) => void;
  totalContentWidth: number;
  editingColumnIndex: number | null;
  setEditingColumnIndex: (i: number | null) => void;
  editingColumnName: string;
  setEditingColumnName: (s: string) => void;
  columnMenuIndex: number | null;
  setColumnMenuIndex: (i: number | null) => void;
  savingColumn: boolean;
  onRunCell: (docId: string, colIndex: number) => void;
  onSaveColumnName: (index: number, name: string) => void;
  onDeleteColumn: (index: number) => void;
  onAddColumn: () => void;
  onCellClick: (cell: {
    rowId: string;
    colIndex: number;
    fullText: string;
  }) => void;
  onAddDocuments: () => void;
}

function Spreadsheet({
  review,
  documents,
  selectedDocIds,
  onSelectionChange,
  totalContentWidth,
  editingColumnIndex,
  setEditingColumnIndex,
  editingColumnName,
  setEditingColumnName,
  columnMenuIndex,
  setColumnMenuIndex,
  savingColumn,
  onRunCell,
  onSaveColumnName,
  onDeleteColumn,
  onAddColumn,
  onCellClick,
  onAddDocuments,
}: SpreadsheetProps) {
  const stickyCellBg = "bg-[var(--bg)]";
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColumnMenuIndex(null);
      }
    }
    if (columnMenuIndex !== null)
      document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [columnMenuIndex, setColumnMenuIndex]);

  const allSelected =
    documents.length > 0 &&
    documents.every((d) => selectedDocIds.includes(d.id));
  const someSelected =
    !allSelected && documents.some((d) => selectedDocIds.includes(d.id));

  function toggleAll() {
    if (allSelected) onSelectionChange([]);
    else onSelectionChange(documents.map((d) => d.id));
  }

  function toggleDoc(id: string) {
    if (selectedDocIds.includes(id))
      onSelectionChange(selectedDocIds.filter((x) => x !== id));
    else onSelectionChange([...selectedDocIds, id]);
  }

  return (
    <div className="mt-4 flex flex-1 flex-col overflow-auto border border-[var(--border)] rounded-lg">
      {/* Header row */}
      <div
        className={`sticky top-0 z-20 flex h-8 ${stickyCellBg}`}
        style={{ minWidth: totalContentWidth }}
      >
        <div
          className={`sticky left-0 z-30 ${DOC_COL_W} ${stickyCellBg} border-b border-r border-[var(--border)] flex items-center gap-4 py-2 pl-4 pr-2 text-left text-xs font-medium text-[var(--text-muted)] select-none`}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-2.5 w-2.5 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
          />
          <span>Document</span>
        </div>
        {review.columns.map((column, colIndex) => (
          <div
            key={colIndex}
            className={`${COL_W} border-b border-r border-[var(--border)] p-2 text-left text-xs font-medium text-[var(--text-muted)] select-none`}
          >
            <div className="flex items-center justify-between gap-3">
              {editingColumnIndex === colIndex ? (
                <input
                  autoFocus
                  value={editingColumnName}
                  onChange={(e) => setEditingColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      onSaveColumnName(colIndex, editingColumnName);
                    if (e.key === "Escape") setEditingColumnIndex(null);
                  }}
                  onBlur={() => onSaveColumnName(colIndex, editingColumnName)}
                  className="min-w-0 flex-1 text-xs text-[var(--text)] bg-transparent outline-none border-b border-[var(--border)] focus:border-[var(--text)]"
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingColumnIndex(colIndex);
                    setEditingColumnName(column);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-xs text-[var(--text)] hover:text-[var(--text)]"
                >
                  {column}
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() =>
                    setColumnMenuIndex(
                      columnMenuIndex === colIndex ? null : colIndex
                    )
                  }
                  className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {columnMenuIndex === colIndex && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setColumnMenuIndex(null);
                        setEditingColumnIndex(colIndex);
                        setEditingColumnName(column);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)] transition-colors flex items-center gap-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </button>
                    <button
                      onClick={() => onDeleteColumn(colIndex)}
                      disabled={savingColumn}
                      className="w-full px-3 py-1.5 text-left text-xs text-[var(--danger)] hover:bg-[var(--hover)] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="flex-1 border-b border-[var(--border)] flex items-center justify-start p-2 min-w-8">
          <button
            onClick={onAddColumn}
            disabled={savingColumn}
            className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="relative min-h-0 flex-1">
        {documents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Upload className="h-6 w-6 text-[var(--text-muted)] mb-2" />
            <p className="text-sm text-[var(--text)]">No documents yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs">
              Attach documents from your Vault to extract data into the columns.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddDocuments}
              className="mt-4"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Add Documents
            </Button>
          </div>
        )}
        {documents.map((doc, docIdx) => {
          const baseRowBg =
            docIdx % 2 === 0 ? stickyCellBg : "bg-[var(--surface-muted)]/30";
          const rowBg = selectedDocIds.includes(doc.id)
            ? "bg-[var(--hover)]"
            : baseRowBg;
          return (
            <div
              key={doc.id}
              className={`flex ${rowBg}`}
              style={{ minWidth: totalContentWidth }}
            >
              <div
                className={`sticky left-0 z-[60] ${DOC_COL_W} border-b border-r border-[var(--border)] py-2 pl-4 pr-2 text-xs text-[var(--text)] flex items-center gap-4 ${rowBg}`}
              >
                <input
                  type="checkbox"
                  checked={selectedDocIds.includes(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  className="h-2.5 w-2.5 shrink-0 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
                />
                <span className="line-clamp-1" title={doc.filename}>
                  {doc.filename}
                </span>
              </div>
              {review.columns.map((_, colIndex) => {
                const cellValue = review.results?.[doc.id]?.[colIndex];
                const hasValue = !!cellValue && cellValue !== "Not specified";
                return (
                  <div
                    key={colIndex}
                    className={`${COL_W} border-b border-r border-[var(--border)] p-2 text-xs text-[var(--text)]`}
                  >
                    {cellValue ? (
                      <button
                        onClick={() => {
                          if (hasValue) {
                            onCellClick({
                              rowId: doc.id,
                              colIndex,
                              fullText: cellValue,
                            });
                          }
                        }}
                        className={`text-left w-full ${
                          hasValue
                            ? "cursor-pointer hover:bg-[var(--hover)] rounded"
                            : "cursor-default"
                        }`}
                      >
                        <span className="line-clamp-2 block">{cellValue}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onRunCell(doc.id, colIndex)}
                        className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                      >
                        —
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="flex-1 border-b border-[var(--border)] min-h-8 min-w-8" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddDocumentsDialog({
  open,
  onOpenChange,
  existingDocIds,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingDocIds: string[];
  onAttach: (docIds: string[]) => void;
}) {
  const [allDocs, setAllDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    fetch("/api/local-vault")
      .then((r) => r.json())
      .then((data) => setAllDocs(data.documents || []))
      .catch((err) =>
        console.error("[TabularReview] Failed to load vault docs:", err)
      )
      .finally(() => setLoading(false));
  }, [open]);

  const existing = new Set(existingDocIds);
  const q = search.toLowerCase();
  const filtered = allDocs.filter(
    (d) => !existing.has(d.id) && (!q || d.filename.toLowerCase().includes(q))
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  function toggleAll() {
    if (allFilteredSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-[var(--border)]">
          <DialogTitle>Add documents from Vault</DialogTitle>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Pick documents to attach to this review. Existing documents are
            hidden.
          </p>
        </DialogHeader>

        <div className="px-6 pt-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 rounded bg-[var(--surface-muted)] animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              {allDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-6 w-6 text-[var(--text-muted)]" />
                  <p>Your Vault is empty. Upload documents to get started.</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        const formData = new FormData();
                        for (const f of files) formData.append("files", f);
                        try {
                          const res = await fetch("/api/local-vault", {
                            method: "POST",
                            body: formData,
                          });
                          if (res.ok) {
                            // Refetch vault docs
                            const refreshed = await fetch("/api/local-vault").then((r) => r.json());
                            setAllDocs(refreshed.documents || []);
                          }
                        } catch (err) {
                          console.error("[TabularReview] Upload failed:", err);
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      Upload documents
                    </span>
                  </label>
                </div>
              ) : search ? (
                "No matching documents."
              ) : (
                "All available documents are already attached."
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="h-2.5 w-2.5 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
                />
                <span>
                  {selected.size} of {filtered.length} selected
                </span>
              </div>
              {filtered.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 py-2 border-b border-[var(--border)]/50 cursor-pointer hover:bg-[var(--hover)] transition-colors px-1 -mx-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleOne(doc.id)}
                    className="h-2.5 w-2.5 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
                  />
                  <span className="flex-1 truncate text-sm text-[var(--text)]">
                    {doc.filename}
                  </span>
                  {doc.fileType && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                      {doc.fileType}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onAttach([...selected])}
            disabled={selected.size === 0}
          >
            Attach {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
