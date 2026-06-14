"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TabularReview {
  id: string;
  name: string;
  document_type?: string | null;
  matter_id?: string | null;
  columns: string[];
  document_ids: string[];
  created_at: string;
}

interface Matter {
  id: string;
  name: string;
}

type Tab = "all" | "in-matter" | "standalone";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in-matter", label: "In Matter" },
  { id: "standalone", label: "Standalone" },
];

const NAME_COL_W = "w-[332px] shrink-0";
const stickyCellBg = "bg-[var(--bg)]";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TabularReviewPage() {
  const [reviews, setReviews] = useState<TabularReview[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchReviews = async () => {
    try {
      const response = await fetch("/api/tabular-review");
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatters = async () => {
    try {
      const response = await fetch("/api/matters");
      if (response.ok) {
        const data = await response.json();
        const list: Matter[] = (data.matters || []).map(
          (m: { id: string; name: string }) => ({ id: m.id, name: m.name })
        );
        setMatters(list);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch matters:", error);
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchMatters();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, matterFilter]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    if (actionsOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [actionsOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenuId(null);
      }
    }
    if (rowMenuId) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [rowMenuId]);

  const q = search.toLowerCase();
  const filtered = reviews
    .filter((r) => {
      if (activeTab === "in-matter") return !!r.matter_id;
      if (activeTab === "standalone") return !r.matter_id;
      return true;
    })
    .filter((r) => !matterFilter || r.matter_id === matterFilter)
    .filter((r) => !q || r.name.toLowerCase().includes(q));

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id));
  const someSelected =
    !allSelected && filtered.some((r) => selectedIds.includes(r.id));

  function toggleAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filtered.map((r) => r.id));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedMatter = matters.find((m) => m.id === matterFilter);

  async function handleRenameSubmit(reviewId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, name: trimmed } : r))
    );
    setRenamingId(null);
    try {
      await fetch(`/api/tabular-review/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (error) {
      console.error("[TabularReview] Failed to rename:", error);
    }
  }

  async function handleDeleteOne(reviewId: string) {
    setRowMenuId(null);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    setSelectedIds((prev) => prev.filter((id) => id !== reviewId));
    try {
      await fetch(`/api/tabular-review/${reviewId}`, { method: "DELETE" });
    } catch (error) {
      console.error("[TabularReview] Failed to delete:", error);
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    setActionsOpen(false);
    setSelectedIds([]);
    setReviews((prev) => prev.filter((r) => !ids.includes(r.id)));
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/tabular-review/${id}`, { method: "DELETE" }).catch(() => {})
      )
    );
  }

  const matterFilterButton = (
    <div className="relative" ref={filterRef}>
      <button
        onClick={() => setFilterOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border ${
          matterFilter
            ? "border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover)]"
            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]"
        }`}
      >
        {selectedMatter ? selectedMatter.name : "Filter by matter"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {filterOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden">
          <button
            onClick={() => {
              setMatterFilter(null);
              setFilterOpen(false);
            }}
            className="flex items-center justify-between w-full px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
          >
            All Matters
            {!matterFilter && (
              <Check className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            )}
          </button>
          {matters.length > 0 && <div className="border-t border-[var(--border)]" />}
          {matters.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMatterFilter(m.id);
                setFilterOpen(false);
              }}
              className="flex items-center justify-between w-full px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
            >
              <span className="truncate pr-2">{m.name}</span>
              {matterFilter === m.id && (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const toolbarActions = (
    <>
      {selectedIds.length > 0 && (
        <div ref={actionsRef} className="relative">
          <button
            onClick={() => setActionsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
          >
            Actions
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {actionsOpen && (
            <div className="absolute top-full right-0 mt-1 w-36 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50 overflow-hidden">
              <button
                onClick={handleDeleteSelected}
                className="w-full px-3 py-1.5 text-left text-xs text-[var(--danger)] hover:bg-[var(--hover)] transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
      {matterFilterButton}
    </>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[32px] font-normal text-[var(--text)]"
            style={{
              fontFamily:
                "var(--font-instrument-serif, 'Instrument Serif', serif)",
            }}
          >
            Tabular Review
          </h1>
          <p className="mt-2 text-sm leading-[1.6] text-[var(--text-muted)]">
            Extract data from documents into structured tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Button
            onClick={() => setNewOpen(true)}
            disabled={creating}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Review</span>
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-8 flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-2 -bottom-px h-px bg-[var(--text)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5">{toolbarActions}</div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-max">
          <div className="flex items-center h-8 pr-3 md:pr-10 border-b border-[var(--border)] text-xs text-[var(--text-muted)] font-medium select-none">
            <div
              className={`sticky left-0 z-[60] ${NAME_COL_W} ${stickyCellBg} flex items-center gap-4 self-stretch pl-4 pr-2 text-left`}
            >
              {loading ? (
                <div className="h-2.5 w-2.5 shrink-0 rounded bg-[var(--surface-muted)] animate-pulse" />
              ) : (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-2.5 w-2.5 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
                />
              )}
              <span>Name</span>
            </div>
            <div className="ml-auto w-24 shrink-0">Columns</div>
            <div className="w-24 shrink-0">Documents</div>
            <div className="w-40 shrink-0">Matter</div>
            <div className="w-32 shrink-0">Created</div>
            <div className="w-8 shrink-0" />
          </div>

          {loading ? (
            <div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center h-10 pr-3 md:pr-10 border-b border-[var(--border)]/50"
                >
                  <div
                    className={`${NAME_COL_W} flex shrink-0 items-center gap-4 pl-4 pr-2`}
                  >
                    <div className="h-2.5 w-2.5 shrink-0 rounded bg-[var(--surface-muted)] animate-pulse" />
                    <div className="h-3.5 w-48 rounded bg-[var(--surface-muted)] animate-pulse" />
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-3 w-8 rounded bg-[var(--surface-muted)] animate-pulse" />
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-3 w-8 rounded bg-[var(--surface-muted)] animate-pulse" />
                  </div>
                  <div className="w-40 shrink-0">
                    <div className="h-3 w-24 rounded bg-[var(--surface-muted)] animate-pulse" />
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="h-3 w-20 rounded bg-[var(--surface-muted)] animate-pulse" />
                  </div>
                  <div className="w-8 shrink-0" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 w-full text-center">
              {activeTab === "all" && !matterFilter ? (
                <>
                  <Table2 className="h-8 w-8 text-[var(--text-muted)] mb-4" />
                  <p
                    className="text-2xl font-medium text-[var(--text)]"
                    style={{
                      fontFamily:
                        "var(--font-instrument-serif, 'Instrument Serif', serif)",
                    }}
                  >
                    Tabular Reviews
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs text-center">
                    Extract data from documents into tables using AI.
                  </p>
                  <Button
                    onClick={() => setNewOpen(true)}
                    disabled={creating}
                    className="mt-4"
                  >
                    + Create New
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  No reviews found
                </p>
              )}
            </div>
          ) : (
            <div>
              {filtered.map((review) => {
                const matter = matters.find(
                  (m) => m.id === review.matter_id
                );
                const rowBg = selectedIds.includes(review.id)
                  ? "bg-[var(--hover)]"
                  : stickyCellBg;
                return (
                  <div
                    key={review.id}
                    onClick={() => {
                      if (renamingId === review.id) return;
                      router.push(`/tabular-review/${review.id}`);
                    }}
                    className={`group flex items-center h-10 pr-3 md:pr-10 border-b border-[var(--border)]/50 hover:bg-[var(--hover)] cursor-pointer transition-colors`}
                  >
                    <div
                      className={`sticky left-0 z-[60] ${NAME_COL_W} ${rowBg} py-2 pl-4 pr-2 transition-colors group-hover:bg-[var(--hover)]`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(review.id)}
                          onChange={() => toggleOne(review.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-2.5 w-2.5 shrink-0 rounded border-[var(--border)] cursor-pointer accent-[var(--text)]"
                        />
                        {renamingId === review.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleRenameSubmit(review.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => handleRenameSubmit(review.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-0 flex-1 text-sm text-[var(--text)] bg-transparent outline-none"
                          />
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
                            {review.name || "Untitled Review"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto w-24 shrink-0 text-sm text-[var(--text-muted)] truncate">
                      {review.columns?.length ?? 0}
                    </div>
                    <div className="w-24 shrink-0 text-sm text-[var(--text-muted)] truncate">
                      {review.document_ids?.length ?? 0}
                    </div>
                    <div className="w-40 shrink-0 text-sm text-[var(--text-muted)] truncate pr-2">
                      {matter ? (
                        matter.name
                      ) : (
                        <span className="text-[var(--text-muted)]/50">—</span>
                      )}
                    </div>
                    <div className="w-32 shrink-0 text-sm text-[var(--text-muted)] truncate">
                      {review.created_at ? (
                        formatDate(review.created_at)
                      ) : (
                        <span className="text-[var(--text-muted)]/50">—</span>
                      )}
                    </div>
                    <div
                      className="w-8 shrink-0 flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative" ref={rowMenuId === review.id ? rowMenuRef : null}>
                        <button
                          onClick={() =>
                            setRowMenuId(
                              rowMenuId === review.id ? null : review.id
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text)] hover:bg-[var(--hover)] rounded transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {rowMenuId === review.id && (
                          <div className="absolute top-full right-0 mt-1 w-32 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50 overflow-hidden">
                            <button
                              onClick={() => {
                                setRowMenuId(null);
                                setRenameValue(
                                  review.name || "Untitled Review"
                                );
                                setRenamingId(review.id);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleDeleteOne(review.id)}
                              className="w-full px-3 py-1.5 text-left text-xs text-[var(--danger)] hover:bg-[var(--hover)] transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NewReviewDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        matters={matters}
        onCreate={async (data) => {
          setCreating(true);
          try {
            const response = await fetch("/api/tabular-review", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...data,
                matterId: data.matterId,
              }),
            });
            if (response.ok) {
              const json = await response.json();
              setNewOpen(false);
              router.push(`/tabular-review/${json.review.id}`);
            }
          } catch (error) {
            console.error("[TabularReview] Failed to create review:", error);
          } finally {
            setCreating(false);
          }
        }}
      />
    </main>
  );
}

function NewReviewDialog({
  open,
  onOpenChange,
  onCreate,
  matters,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matters: Matter[];
  onCreate: (data: {
    name: string;
    documentType?: string;
    columns: string[];
    documentIds: string[];
    matterId?: string | null;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [matterId, setMatterId] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([""]);

  // Reset form fields when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDocumentType("");
      setMatterId("");
      setColumns([""]);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name,
      documentType,
      columns: columns.filter((c) => c.trim() !== ""),
      documentIds: [],
      matterId: matterId || null,
    });
    setName("");
    setDocumentType("");
    setMatterId("");
    setColumns([""]);
  };

  const addColumn = () => setColumns([...columns, ""]);
  const updateColumn = (index: number, value: string) => {
    const newColumns = [...columns];
    newColumns[index] = value;
    setColumns(newColumns);
  };
  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const documentTypeOptions = [
    "NDA",
    "Employment Contract",
    "Service Agreement",
    "Lease",
    "Court Judgment",
    "Custom",
  ];

  const defaultColumns: Record<string, string[]> = {
    NDA: [
      "Governing Law",
      "Confidentiality Period",
      "Permitted Disclosures",
      "Return of Information",
      "Non-Solicitation",
      "Dispute Resolution",
      "Auto-Renewal",
    ],
    "Employment Contract": [
      "Governing Law",
      "Notice Period",
      "Non-Compete",
      "IP Assignment",
      "Severance",
      "Probation Period",
      "Arbitration Clause",
    ],
    "Service Agreement": [
      "Governing Law",
      "Liability Cap",
      "Indemnity",
      "Payment Terms",
      "Termination for Convenience",
      "Dispute Resolution",
      "SLA",
    ],
    Lease: [
      "Governing Law",
      "Lease Term",
      "Rent Amount",
      "Rent Review",
      "Break Clause",
      "Deposit Amount",
      "Permitted Use",
    ],
    "Court Judgment": [
      "Jurisdiction",
      "Court",
      "Date",
      "Outcome",
      "Key Legal Principle",
      "Damages Awarded",
      "Appeal Filed",
    ],
  };

  const handleDocumentTypeChange = (value: string) => {
    setDocumentType(value);
    if (defaultColumns[value]) {
      setColumns(defaultColumns[value]);
    } else {
      setColumns([""]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create New Review</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="name">Review name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NDAs Q1 2026"
              required
            />
          </div>
          <div>
            <Label htmlFor="documentType">Document type</Label>
            <Select value={documentType} onValueChange={handleDocumentTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="matter">Matter (optional)</Label>
            <Select value={matterId || "none"} onValueChange={(v) => setMatterId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Standalone (no matter)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Standalone (no matter)</SelectItem>
                {matters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="columns">Columns</Label>
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={column}
                    onChange={(e) => updateColumn(index, e.target.value)}
                    placeholder={`Column ${index + 1}`}
                  />
                  {columns.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeColumn(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addColumn}
                className="w-full"
              >
                + Add Column
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            You can attach documents from your Vault on the next step.
          </p>
          <Button type="submit" className="w-full">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
