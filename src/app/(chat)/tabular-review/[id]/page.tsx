"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus, Trash2, Edit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TabularReview {
  id: string;
  name: string;
  document_type?: string;
  columns: string[];
  document_ids: string[];
  results: { [docId: string]: { [colIndex: string]: string } };
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  content?: string;
  fileType: string;
  sizeBytes: number;
}

export default function TabularReviewDetailPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const [review, setReview] = useState<TabularReview | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colIndex: number; fullText: string } | null>(null);

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

  const fetchDocuments = useCallback(async () => {
    if (!review) return;
    try {
      const response = await fetch("/api/local-vault");
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.documents || []).filter((d: Document) =>
          review.document_ids.includes(d.id)
        );
        setDocuments(filtered);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch documents:", error);
    }
  }, [review]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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

  const addColumn = async () => {
    if (!review || !newColumnName.trim()) return;
    const newColumns = [...review.columns, newColumnName.trim()];
    await updateReview({ columns: newColumns });
    setNewColumnName("");
  };

  const deleteColumn = async (index: number) => {
    if (!review) return;
    const newColumns = review.columns.filter((_, i) => i !== index);
    await updateReview({ columns: newColumns });
  };

  const startEditColumn = (index: number, name: string) => {
    setEditingColumn(index);
    setEditingColumnName(name);
  };

  const saveEditColumn = async () => {
    if (!review || editingColumn === null) return;
    const newColumns = [...review.columns];
    newColumns[editingColumn] = editingColumnName.trim() || newColumns[editingColumn];
    await updateReview({ columns: newColumns });
    setEditingColumn(null);
  };

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
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${review.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-10 text-center text-[var(--text-muted)]">Loading review...</div>;
  }

  if (!review) {
    return <div className="p-10 text-center text-[var(--text-muted)]">Review not found.</div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{review.name}</h1>
          {review.document_type && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{review.document_type}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline">
            Export CSV
          </Button>
          <Button onClick={runAll} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run All"}
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-left text-sm font-medium">
                Document
              </th>
              {review.columns.map((column, index) => (
                <th
                  key={index}
                  className="min-w-[200px] border-b border-r border-[var(--border)] px-4 py-3 text-left text-sm font-medium"
                >
                  {editingColumn === index ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEditColumn()}
                        className="h-7"
                        autoFocus
                      />
                      <button onClick={saveEditColumn} className="text-xs text-[var(--accent)]">
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>{column}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditColumn(index, column)}
                          className="text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteColumn(index)}
                          className="text-[var(--danger)] hover:opacity-80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </th>
              ))}
              <th className="min-w-[150px] border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-1">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addColumn()}
                    placeholder="New column"
                    className="h-7"
                  />
                  <button onClick={addColumn} className="text-[var(--accent)]">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-[var(--hover)]">
                <td className="sticky left-0 z-10 min-w-[200px] border-b border-r border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm">
                  {doc.filename}
                </td>
                {review.columns.map((_, colIndex) => {
                  const cellValue = review.results?.[doc.id]?.[colIndex];
                  return (
                    <td
                      key={colIndex}
                      className="min-w-[200px] cursor-pointer border-b border-r border-[var(--border)] px-4 py-3 text-sm"
                      onClick={() => {
                        if (cellValue && cellValue !== "Not specified") {
                          setSelectedCell({ rowId: doc.id, colIndex, fullText: cellValue });
                        }
                      }}
                    >
                      {cellValue ? (
                        <span className="line-clamp-2">{cellValue}</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runCell(doc.id, colIndex);
                          }}
                          className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                        >
                          —
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-[var(--border)] px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              <button onClick={() => setSelectedCell(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-[var(--text)]">{selectedCell.fullText}</p>
          </div>
        </div>
      )}
    </main>
  );
}
