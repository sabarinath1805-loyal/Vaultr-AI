"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import useLocalVaultStore, { rehydrateLocalVaultSafely } from "@/app/hooks/useLocalVaultStore";
import { AddDocumentsModal } from "@/components/shared/add-documents-modal";
import { formatBytes } from "@/lib/local-documents";
import { getRiskCounts } from "@/lib/contract-scanner";
import {
  type BillingEntry,
  type KeyDate,
  type Matter,
  type MatterLinks,
  type MatterNote,
  type MatterStatus,
  type Party,
  type TimelineEntry,
  MATTER_STATUS_WORKFLOW,
  PARTY_ROLES,
  addTimelineEntry,
  billingToCSV,
  persistMatterUpdate,
  readMatterLinks,
  readMatters,
  totalBillingFees,
  totalBillingHours,
  writeMatterLinks,
  writeMatters,
} from "@/lib/matters";
import { parseScanReportContent, type ScanReportEntry } from "@/lib/scan-reports";
import { generateUUID } from "@/lib/utils";
import { stripAssistantMarkup } from "@/lib/chat-message-content";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type Tab = "overview" | "documents" | "chats" | "scans" | "timeline" | "notes" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "chats", label: "Threads" },
  { id: "scans", label: "Contract Scans" },
  { id: "timeline", label: "Timeline" },
  { id: "notes", label: "Notes" },
  { id: "billing", label: "Billing" },
];

const STATUS_COLOURS: Record<MatterStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  "In Hearing": "bg-amber-100 text-amber-800",
  "Judgment Received": "bg-blue-100 text-blue-800",
  Closed: "bg-gray-200 text-gray-700",
  Archived: "bg-gray-100 text-gray-500",
};

/* ------------------------------------------------------------------ */
/*  Currency helper (BUG 8)                                            */
/* ------------------------------------------------------------------ */

function getCurrencyForJurisdiction(jurisdiction?: string): string {
  const map: Record<string, string> = {
    sg: "SGD", uk: "GBP", au: "AUD", us: "USD",
    eu: "EUR", in: "INR", ca: "CAD", my: "MYR",
  };
  try {
    const profile = JSON.parse(localStorage.getItem("vaultr_user_profile") || "{}");
    return map[profile.jurisdiction] || (jurisdiction ? map[jurisdiction] : undefined) || "USD";
  } catch {
    return "SGD";
  }
}

/* ------------------------------------------------------------------ */
/*  Inline calendar component (BUG 7)                                  */
/* ------------------------------------------------------------------ */

function BillingCalendar({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const selectDate = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });
  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  const isSelected = (day: number) => value === `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none hover:bg-[var(--surface)]"
      >
        <Calendar className="h-3 w-3 text-[var(--text-muted)]" />
        {value || "Pick date"}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="rounded p-1 hover:bg-[var(--hover)]">
              <ChevronLeft className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
            <span className="text-base font-medium text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
              {monthLabel}
            </span>
            <button type="button" onClick={nextMonth} className="rounded p-1 hover:bg-[var(--hover)]">
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0">
            {dayNames.map((d) => (
              <div key={d} className="flex h-8 items-center justify-center text-xs uppercase tracking-wide text-[var(--text-muted)]">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`prev-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-[var(--text-faint)] opacity-40">
                {prevMonthDays - firstDayOfWeek + 1 + i}
              </div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected(day)
                      ? "bg-[#5c5248] text-white"
                      : "cursor-pointer text-[var(--text)] hover:bg-[var(--hover)]"
                  }`}
                >
                  {day}
                  {isToday(day) && !isSelected(day) && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#5c5248]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [matters, setMatters] = useState<Matter[]>([]);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [links, setLinks] = useState<MatterLinks>({ documents: [], chats: [], scans: [] });
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [scanPickerOpen, setScanPickerOpen] = useState(false);
  const [scanReports, setScanReports] = useState<ScanReportEntry[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // AI loading states
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [extractDatesLoading, setExtractDatesLoading] = useState(false);
  const [identifyPartiesLoading, setIdentifyPartiesLoading] = useState(false);
  const [draftTimelineLoading, setDraftTimelineLoading] = useState(false);
  const [draftTimelineResult, setDraftTimelineResult] = useState<string | null>(null);

  // Suggested dates/parties from AI
  const [suggestedDates, setSuggestedDates] = useState<KeyDate[]>([]);
  const [suggestedParties, setSuggestedParties] = useState<Party[]>([]);

  const documents = useLocalVaultStore((state) => state.documents);
  const addDocuments = useLocalVaultStore((state) => state.addDocuments);
  const chats = useChatStore((state) => state.chats);
  const loadChats = useChatStore((state) => state.loadChats);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- Load data ---------- */

  useEffect(() => {
    const all = readMatters();
    setMatters(all);
    setMatter(all.find((m) => m.id === id) || null);
    setLinks(readMatterLinks(id));
  }, [id]);

  useEffect(() => {
    loadChats().catch(() => undefined);
    rehydrateLocalVaultSafely().catch(() => undefined);
    fetch("/api/scan-reports", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((data: { reports?: ScanReportEntry[] }) => setScanReports(Array.isArray(data.reports) ? data.reports : []))
      .catch(() => setScanReports([]));
  }, [loadChats]);

  /* ---------- Derived data ---------- */

  const linkedDocuments = useMemo(
    () => documents.filter((doc) => links.documents.includes(doc.id)),
    [documents, links.documents]
  );
  const linkedChats = links.chats.map((chatId) => (chats ?? {})[chatId]).filter(Boolean);
  const linkedScans = links.scans
    .map((scanId) => scanReports.find((r) => r.id === scanId))
    .filter((r): r is ScanReportEntry => Boolean(r));

  /* ---------- Persist helpers ---------- */

  const persistLinks = useCallback(
    (next: MatterLinks) => {
      setLinks(next);
      writeMatterLinks(id, next);
    },
    [id]
  );

  const updateMatter = useCallback(
    (updater: (m: Matter) => Matter, timelineType?: TimelineEntry["type"], timelineDesc?: string) => {
      setMatters((prev) => {
        const current = prev.find((m) => m.id === id);
        if (!current) return prev;
        let updated = updater(current);
        if (timelineType && timelineDesc) {
          updated = addTimelineEntry(updated, timelineType, timelineDesc);
        }
        const next = persistMatterUpdate(prev, updated);
        setMatter(updated);
        return next;
      });
    },
    [id]
  );

  /* ---------- Status workflow ---------- */

  const cycleStatus = (newStatus: MatterStatus) => {
    updateMatter(
      (m) => ({ ...m, status: newStatus }),
      "status",
      `Status changed to ${newStatus}`
    );
    setStatusMenuOpen(false);
  };

  /* ---------- Document upload ---------- */

  const handleDirectUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const uploaded = addDocuments(files, null);
    const newDocIds = uploaded.map((d) => d.id);
    persistLinks({ ...links, documents: Array.from(new Set([...links.documents, ...newDocIds])) });
    uploaded.forEach((d) => {
      updateMatter((m) => m, "document", `Document uploaded: ${d.filename}`);
    });
    event.target.value = "";
  };

  /* ---------- Tags ---------- */

  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || matter?.tags.includes(tag)) return;
    updateMatter((m) => ({ ...m, tags: [...m.tags, tag] }));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateMatter((m) => ({ ...m, tags: m.tags.filter((t) => t !== tag) }));
  };

  /* ---------- Key dates ---------- */

  const [dateForm, setDateForm] = useState({ label: "", date: "", description: "" });
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const addKeyDate = () => {
    if (!dateForm.label || !dateForm.date) return;
    const newDate: KeyDate = { id: generateUUID(), ...dateForm };
    updateMatter(
      (m) => ({ ...m, keyDates: [...m.keyDates, newDate].sort((a, b) => a.date.localeCompare(b.date)) }),
      "date",
      `Key date added: ${dateForm.label} (${dateForm.date})`
    );
    setDateForm({ label: "", date: "", description: "" });
  };

  const removeKeyDate = (dateId: string) => {
    const target = matter?.keyDates.find((d) => d.id === dateId);
    updateMatter(
      (m) => ({ ...m, keyDates: m.keyDates.filter((d) => d.id !== dateId) }),
      "date",
      `Key date removed: ${target?.label || "Unknown"}`
    );
  };

  /* ---------- Parties ---------- */

  const emptyParty = { name: "", role: "Other" as Party["role"], organisation: "", email: "", phone: "" };
  const [partyForm, setPartyForm] = useState(emptyParty);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);

  const addParty = () => {
    if (!partyForm.name) return;
    if (editingPartyId) {
      updateMatter(
        (m) => ({ ...m, parties: m.parties.map((p) => (p.id === editingPartyId ? { ...partyForm, id: editingPartyId } : p)) }),
        "party",
        `Party updated: ${partyForm.name}`
      );
      setEditingPartyId(null);
    } else {
      const newParty: Party = { id: generateUUID(), ...partyForm };
      updateMatter(
        (m) => ({ ...m, parties: [...m.parties, newParty] }),
        "party",
        `Party added: ${partyForm.name} (${partyForm.role})`
      );
    }
    setPartyForm(emptyParty);
  };

  const editParty = (p: Party) => {
    setPartyForm({ name: p.name, role: p.role, organisation: p.organisation, email: p.email, phone: p.phone });
    setEditingPartyId(p.id);
  };

  const removeParty = (partyId: string) => {
    const target = matter?.parties.find((p) => p.id === partyId);
    updateMatter(
      (m) => ({ ...m, parties: m.parties.filter((p) => p.id !== partyId) }),
      "party",
      `Party removed: ${target?.name || "Unknown"}`
    );
  };

  /* ---------- Notes ---------- */

  const [noteForm, setNoteForm] = useState({ title: "", content: "" });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");

  const saveNote = () => {
    if (!noteForm.title.trim()) return;
    const now = new Date().toISOString();
    if (editingNoteId) {
      updateMatter(
        (m) => ({
          ...m,
          notes: m.notes.map((n) =>
            n.id === editingNoteId ? { ...n, title: noteForm.title, content: noteForm.content, updatedAt: now } : n
          ),
        }),
        "note",
        `Note updated: ${noteForm.title}`
      );
      setEditingNoteId(null);
    } else {
      const newNote: MatterNote = { id: generateUUID(), title: noteForm.title, content: noteForm.content, createdAt: now, updatedAt: now };
      updateMatter(
        (m) => ({ ...m, notes: [newNote, ...m.notes] }),
        "note",
        `Note added: ${noteForm.title}`
      );
    }
    setNoteForm({ title: "", content: "" });
  };

  const deleteNote = (noteId: string) => {
    const target = matter?.notes.find((n) => n.id === noteId);
    updateMatter(
      (m) => ({ ...m, notes: m.notes.filter((n) => n.id !== noteId) }),
      "note",
      `Note deleted: ${target?.title || "Unknown"}`
    );
  };

  const filteredNotes = useMemo(() => {
    if (!matter) return [];
    const q = noteSearch.toLowerCase().trim();
    if (!q) return matter.notes;
    return matter.notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [matter, noteSearch]);

  /* ---------- Billing ---------- */

  const [billingForm, setBillingForm] = useState({ date: "", description: "", hours: "", rate: "" });

  const addBillingEntry = () => {
    if (!billingForm.date || !billingForm.description || !billingForm.hours) return;
    const entry: BillingEntry = {
      id: generateUUID(),
      date: billingForm.date,
      description: billingForm.description,
      hours: parseFloat(billingForm.hours) || 0,
      rate: parseFloat(billingForm.rate) || 0,
    };
    updateMatter(
      (m) => ({ ...m, billingEntries: [...m.billingEntries, entry] }),
      "billing",
      `Time entry: ${entry.hours}h — ${entry.description}`
    );
    setBillingForm({ date: "", description: "", hours: "", rate: "" });
  };

  const removeBillingEntry = (entryId: string) => {
    updateMatter((m) => ({ ...m, billingEntries: m.billingEntries.filter((e) => e.id !== entryId) }));
  };

  const exportBillingCSV = () => {
    if (!matter) return;
    const csv = billingToCSV(matter.billingEntries, matter.name, getCurrencyForJurisdiction(matter.jurisdiction));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${matter.name.replace(/[^a-zA-Z0-9]/g, "-")}-billing.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Related matters ---------- */

  const [relatedSearch, setRelatedSearch] = useState("");
  const [relatedPickerOpen, setRelatedPickerOpen] = useState(false);

  const availableRelated = useMemo(() => {
    if (!matter) return [];
    const q = relatedSearch.toLowerCase().trim();
    return matters.filter(
      (m) => m.id !== id && !matter.relatedMatters.includes(m.id) && (!q || m.name.toLowerCase().includes(q) || m.client.toLowerCase().includes(q))
    );
  }, [matters, matter, id, relatedSearch]);

  const linkRelatedMatter = (relatedId: string) => {
    const related = matters.find((m) => m.id === relatedId);
    updateMatter((m) => ({ ...m, relatedMatters: [...m.relatedMatters, relatedId] }));
    if (related) {
      const rMatters = readMatters();
      const rMatter = rMatters.find((m) => m.id === relatedId);
      if (rMatter && !rMatter.relatedMatters.includes(id)) {
        const updated = { ...rMatter, relatedMatters: [...rMatter.relatedMatters, id] };
        writeMatters(rMatters.map((m) => (m.id === relatedId ? updated : m)));
      }
    }
    setRelatedPickerOpen(false);
    setRelatedSearch("");
  };

  const unlinkRelatedMatter = (relatedId: string) => {
    updateMatter((m) => ({ ...m, relatedMatters: m.relatedMatters.filter((r) => r !== relatedId) }));
  };

  /* ---------- AI: Summary ---------- */

  const generateSummary = async () => {
    if (!matter || linkedDocuments.length === 0) return;
    setSummaryLoading(true);
    try {
      const docContext = linkedDocuments.map((d) => `- ${d.filename}${d.content ? `: ${d.content.slice(0, 2000)}` : ""}`).join("\n");
      const prompt = `Summarise this legal matter in one paragraph.\n\nMatter: ${matter.name}\nType: ${matter.type}\nClient: ${matter.client || "N/A"}\nJurisdiction: ${matter.jurisdiction || "N/A"}\n\nAttached documents:\n${docContext}\n\nProvide a concise one-paragraph summary.`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedModel: "claude-haiku-4-5-20251001" }),
      });
      if (!res.ok) throw new Error("Failed");
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.startsWith("0:"));
      const summary = lines.map((l) => JSON.parse(l.slice(2))).join("");
      updateMatter((m) => ({ ...m, summary }), "summary", "Matter summary generated");
    } catch {
      // Silently fail
    } finally {
      setSummaryLoading(false);
    }
  };

  /* ---------- AI: Extract dates ---------- */

  const extractDates = async () => {
    if (!matter) return;
    if (linkedDocuments.length === 0) {
      toast.error("Attach at least one document first");
      return;
    }
    setExtractDatesLoading(true);
    try {
      const docContext = linkedDocuments.map((d) => `${d.filename}: ${d.content?.slice(0, 3000) || "(no text extracted)"}`).join("\n\n");
      const prompt = `Extract only legally significant dates from this document — court dates, filing deadlines, contract execution dates, hearing dates, judgment dates, limitation periods, signing dates. Do NOT extract: file size, page count, word count, byte counts, or any numerical values that are not actual calendar dates. Return ONLY a JSON array of objects with fields: label (string), date (YYYY-MM-DD), description (string).\n\nDocuments:\n${docContext}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedModel: "claude-haiku-4-5-20251001" }),
      });
      if (!res.ok) throw new Error("Failed");
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.startsWith("0:"));
      const content = lines.map((l) => JSON.parse(l.slice(2))).join("");
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { label: string; date: string; description: string }[];
        setSuggestedDates(parsed.map((d) => ({ id: generateUUID(), label: d.label, date: d.date, description: d.description || "" })));
        toast.success(`Found ${parsed.length} suggested date${parsed.length === 1 ? "" : "s"}`);
      } else {
        toast.error("Could not parse dates from the response");
      }
    } catch {
      toast.error("Failed to extract dates");
    } finally {
      setExtractDatesLoading(false);
    }
  };

  const acceptSuggestedDate = (date: KeyDate) => {
    updateMatter(
      (m) => ({ ...m, keyDates: [...m.keyDates, date].sort((a, b) => a.date.localeCompare(b.date)) }),
      "date",
      `Key date added (AI-extracted): ${date.label}`
    );
    setSuggestedDates((prev) => prev.filter((d) => d.id !== date.id));
  };

  /* ---------- AI: Identify parties ---------- */

  const identifyParties = async () => {
    if (!matter) return;
    if (linkedDocuments.length === 0) {
      toast.error("Attach at least one document first");
      return;
    }
    setIdentifyPartiesLoading(true);
    try {
      const docContext = linkedDocuments.map((d) => `${d.filename}: ${d.content?.slice(0, 3000) || "(no text extracted)"}`).join("\n\n");
      const prompt = `Identify all parties mentioned in these legal documents. Return ONLY a JSON array of objects with fields: name (string), role (one of: Claimant, Defendant, Counsel, Judge, Witness, Other), organisation (string or empty). Do not include any other text.\n\nDocuments:\n${docContext}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedModel: "claude-haiku-4-5-20251001" }),
      });
      if (!res.ok) throw new Error("Failed");
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.startsWith("0:"));
      const content = lines.map((l) => JSON.parse(l.slice(2))).join("");
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { name: string; role: string; organisation?: string }[];
        setSuggestedParties(
          parsed.map((p) => ({
            id: generateUUID(),
            name: p.name,
            role: (PARTY_ROLES.includes(p.role as Party["role"]) ? p.role : "Other") as Party["role"],
            organisation: p.organisation || "",
            email: "",
            phone: "",
          }))
        );
        toast.success(`Found ${parsed.length} suggested ${parsed.length === 1 ? "party" : "parties"}`);
      } else {
        toast.error("Could not parse parties from the response");
      }
    } catch {
      toast.error("Failed to identify parties");
    } finally {
      setIdentifyPartiesLoading(false);
    }
  };

  const acceptSuggestedParty = (party: Party) => {
    updateMatter(
      (m) => ({ ...m, parties: [...m.parties, party] }),
      "party",
      `Party added (AI-identified): ${party.name} (${party.role})`
    );
    setSuggestedParties((prev) => prev.filter((p) => p.id !== party.id));
  };

  /* ---------- AI: Draft timeline ---------- */

  const draftTimeline = async () => {
    if (!matter) return;
    if (linkedDocuments.length === 0) {
      toast.error("Attach at least one document first");
      return;
    }
    setDraftTimelineLoading(true);
    try {
      const docContext = linkedDocuments.map((d) => `${d.filename}: ${d.content?.slice(0, 3000) || "(no text extracted)"}`).join("\n\n");
      const prompt = `You are a legal AI assistant. Based on the matter details and documents provided, draft a chronological timeline of key events. Format as a numbered list: [Date] — [Event] — [Legal significance]. Only include actual legal events — not document metadata like file size or page count. Be concise and precise.\n\nMatter: ${matter.name}\nDocuments:\n${docContext}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedModel: "claude-haiku-4-5-20251001" }),
      });
      if (!res.ok) throw new Error("Failed");
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.startsWith("0:"));
      const content = lines.map((l) => JSON.parse(l.slice(2))).join("");
      if (content.trim()) {
        setDraftTimelineResult(stripAssistantMarkup(content));
        toast.success("Timeline draft ready");
      } else {
        toast.error("Could not generate timeline from documents");
      }
    } catch {
      toast.error("Failed to draft timeline");
    } finally {
      setDraftTimelineLoading(false);
    }
  };

  /* ---------- Ask Lex (enhanced) ---------- */

  const askLexFull = () => {
    if (!matter) return;
    const chatId = generateUUID();
    persistLinks({ ...links, chats: Array.from(new Set([...links.chats, chatId])) });

    const contextParts: string[] = [
      `Matter: ${matter.name}`,
      `Type: ${matter.type} | Status: ${matter.status}`,
      matter.client ? `Client: ${matter.client}` : "",
      matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : "",
      matter.practiceArea ? `Practice Area: ${matter.practiceArea}` : "",
      matter.summary ? `\nSummary: ${matter.summary}` : "",
    ];

    if (matter.parties.length > 0) {
      contextParts.push("\nParties:");
      matter.parties.forEach((p) => contextParts.push(`- ${p.name} (${p.role})${p.organisation ? ` — ${p.organisation}` : ""}`));
    }

    if (matter.keyDates.length > 0) {
      contextParts.push("\nKey Dates:");
      matter.keyDates.forEach((d) => contextParts.push(`- ${d.label}: ${d.date}${d.description ? ` — ${d.description}` : ""}`));
    }

    if (matter.notes.length > 0) {
      contextParts.push("\nNotes:");
      matter.notes.slice(0, 5).forEach((n) => contextParts.push(`- ${n.title}: ${n.content.slice(0, 500)}`));
    }

    if (linkedDocuments.length > 0) {
      contextParts.push("\nAttached Documents:");
      linkedDocuments.forEach((d) => {
        contextParts.push(`- ${d.filename}${d.content ? `: ${d.content.slice(0, 1500)}` : ""}`);
      });
    }

    if (matter.timeline.length > 0) {
      contextParts.push("\nRecent Activity:");
      matter.timeline.slice(0, 10).forEach((t) => contextParts.push(`- [${t.type}] ${t.description} (${new Date(t.timestamp).toLocaleDateString()})`));
    }

    const context = contextParts.filter(Boolean).join("\n");
    const store = useChatStore.getState();
    // Composer starts empty per product decision. We persist the matter context
    // on the chat itself so Lex can use it from the system prompt / chat title.
    void context;
    store.saveMessages(chatId, [{
      id: generateUUID(),
      role: "assistant",
      content: `I have the full context for **${matter.name}** including ${linkedDocuments.length} document(s), ${matter.parties.length} parties, ${matter.keyDates.length} key dates, and ${matter.notes.length} notes. What would you like to work on?`,
      createdAt: new Date(),
    }]).then(() => {
      updateMatter((m) => m, "chat", "Asked Lex about this matter");
      router.push(`/c/${chatId}`);
    });
  };

  /* ---------- Export ---------- */

  const exportMatter = async () => {
    if (!matter) return;
    const sections: string[] = [];
    sections.push(`# ${matter.name}`);
    sections.push(`**Client:** ${matter.client || "N/A"} | **Type:** ${matter.type} | **Status:** ${matter.status}`);
    if (matter.tags.length > 0) sections.push(`**Tags:** ${matter.tags.join(", ")}`);
    if (matter.summary) sections.push(`\n## Summary\n${matter.summary}`);
    if (matter.parties.length > 0) {
      sections.push("\n## Parties");
      matter.parties.forEach((p) => sections.push(`- **${p.name}** (${p.role})${p.organisation ? ` — ${p.organisation}` : ""}${p.email ? ` | ${p.email}` : ""}${p.phone ? ` | ${p.phone}` : ""}`));
    }
    if (matter.keyDates.length > 0) {
      sections.push("\n## Key Dates");
      matter.keyDates.forEach((d) => sections.push(`- **${d.label}**: ${d.date}${d.description ? ` — ${d.description}` : ""}`));
    }
    if (linkedDocuments.length > 0) {
      sections.push("\n## Documents");
      linkedDocuments.forEach((d) => sections.push(`- ${d.filename} (${formatBytes(d.sizeBytes)})`));
    }
    if (linkedScans.length > 0) {
      sections.push("\n## Contract Scans");
      linkedScans.forEach((s) => sections.push(`- ${s.filename} — ${s.overallRisk || "Risk pending"}`));
    }
    if (linkedChats.length > 0) {
      sections.push("\n## Chat Threads");
      linkedChats.forEach((c) => sections.push(`- ${c.title} (${new Date(c.updatedAt).toLocaleDateString()})`));
    }
    if (matter.notes.length > 0) {
      sections.push("\n## Notes");
      matter.notes.forEach((n) => sections.push(`### ${n.title}\n${n.content}\n`));
    }
    if (matter.billingEntries.length > 0) {
      sections.push("\n## Billing");
      sections.push(`Total: $${totalBillingFees(matter.billingEntries).toFixed(2)} (${totalBillingHours(matter.billingEntries).toFixed(1)}h)`);
      matter.billingEntries.forEach((e) => sections.push(`- ${e.date}: ${e.description} — ${e.hours}h @ $${e.rate}/h = $${(e.hours * e.rate).toFixed(2)}`));
    }

    const content = sections.join("\n");

    try {
      const res = await fetch("/api/export-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename: `${matter.name.replace(/[^a-zA-Z0-9]/g, "-")}-export` }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${matter.name.replace(/[^a-zA-Z0-9]/g, "-")}-export.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        updateMatter((m) => m, "export", "Matter exported as PDF");
      }
    } catch {
      // Fallback: download as markdown
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${matter.name.replace(/[^a-zA-Z0-9]/g, "-")}-export.md`;
      a.click();
      URL.revokeObjectURL(url);
      updateMatter((m) => m, "export", "Matter exported as Markdown");
    }
  };

  /* ---------- Render ---------- */

  if (!matter) {
    return (
      <main className="h-screen bg-[var(--bg)] p-8 text-sm text-[var(--text-muted)]">
        Matter not found.
      </main>
    );
  }

  const now = new Date();

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)] px-8 py-6">
      {/* Back + header */}
      <button type="button" onClick={() => router.push("/matters")} className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Matters
      </button>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-normal text-[var(--text)]">{matter.name}</h1>
            {/* Status pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOURS[matter.status]}`}
              >
                {matter.status}
                <ChevronDown className="h-3 w-3" />
              </button>
              {statusMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
                  {MATTER_STATUS_WORKFLOW.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => cycleStatus(s)}
                      className={`block w-full px-4 py-1.5 text-left text-xs hover:bg-[var(--surface)] ${s === matter.status ? "font-medium text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
            <span>{matter.client || "No client"}</span>
            <span>·</span>
            <span>{matter.type}</span>
            <span>·</span>
            <span>{new Date(matter.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {matter.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                <Tag className="h-3 w-3" />
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 text-[var(--text-faint)] hover:text-[var(--text)]">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <form
              className="flex items-center"
              onSubmit={(e) => { e.preventDefault(); addTag(); }}
            >
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="+ Add tag"
                className="w-20 bg-transparent text-[11px] text-[var(--text-muted)] outline-none placeholder:text-[var(--text-faint)]"
              />
            </form>
          </div>

          {/* Summary */}
          {matter.summary && (
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
              {matter.summary}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {linkedDocuments.length > 0 && (
              <button
                type="button"
                onClick={generateSummary}
                disabled={summaryLoading}
                className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {summaryLoading ? "Generating..." : matter.summary ? "Refresh Summary" : "Generate Summary"}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={askLexFull}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Ask Lex
          </button>
          <button
            type="button"
            onClick={exportMatter}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-[13px] transition-colors ${
              activeTab === tab.id
                ? "border-[var(--text)] font-medium text-[var(--text)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <section className="py-8">
        {/* ======================== OVERVIEW ======================== */}
        {activeTab === "overview" && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Parties */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                  <Users className="h-4 w-4" /> Parties ({matter.parties.length})
                </h3>
                {linkedDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={identifyParties}
                    disabled={identifyPartiesLoading}
                    className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" />
                    {identifyPartiesLoading ? "Identifying..." : "Auto-identify"}
                  </button>
                )}
              </div>

              {suggestedParties.length > 0 && (
                <div className="mt-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 text-xs font-medium text-amber-800">Suggested parties — click to add:</div>
                  {suggestedParties.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => acceptSuggestedParty(p)}
                      className="mb-1 mr-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-amber-800 shadow-sm hover:bg-amber-100"
                    >
                      <Plus className="h-3 w-3" /> {p.name} ({p.role})
                    </button>
                  ))}
                </div>
              )}

              {matter.parties.length > 0 && (
                <div className="mt-3 space-y-2">
                  {matter.parties.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-[var(--text)]">{p.name}</span>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.role === "Claimant" ? "bg-blue-100 text-blue-800" : p.role === "Defendant" ? "bg-red-100 text-red-800" : p.role === "Counsel" ? "bg-purple-100 text-purple-800" : p.role === "Judge" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                          {p.role}
                        </span>
                        {p.organisation && <span className="ml-2 text-xs text-[var(--text-muted)]">{p.organisation}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => editParty(p)} className="p-1 text-[var(--text-faint)] hover:text-[var(--text)]">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeParty(p.id)} className="p-1 text-[var(--text-faint)] hover:text-[var(--danger)]">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <div className="text-xs font-medium text-[var(--text-muted)]">{editingPartyId ? "Edit Party" : "Add Party"}</div>
                <input value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} placeholder="Name" className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <div className="flex gap-2">
                  <select value={partyForm.role} onChange={(e) => setPartyForm({ ...partyForm, role: e.target.value as Party["role"] })} className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none">
                    {PARTY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input value={partyForm.organisation} onChange={(e) => setPartyForm({ ...partyForm, organisation: e.target.value })} placeholder="Organisation" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                </div>
                <div className="flex gap-2">
                  <input value={partyForm.email} onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })} placeholder="Email" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                  <input value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} placeholder="Phone" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addParty} disabled={!partyForm.name} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50">
                    {editingPartyId ? "Update" : "Add"}
                  </button>
                  {editingPartyId && (
                    <button type="button" onClick={() => { setEditingPartyId(null); setPartyForm(emptyParty); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Key Dates */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                  <Calendar className="h-4 w-4" /> Key Dates ({matter.keyDates.length})
                </h3>
                {linkedDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={extractDates}
                    disabled={extractDatesLoading}
                    className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" />
                    {extractDatesLoading ? "Extracting..." : "Extract Dates"}
                  </button>
                )}
              </div>

              {suggestedDates.length > 0 && (
                <div className="mt-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 text-xs font-medium text-amber-800">Suggested dates — click to add:</div>
                  {suggestedDates.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => acceptSuggestedDate(d)}
                      className="mb-1 mr-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-amber-800 shadow-sm hover:bg-amber-100"
                    >
                      <Plus className="h-3 w-3" /> {d.label} ({d.date})
                    </button>
                  ))}
                </div>
              )}

              {matter.keyDates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {matter.keyDates.map((d) => {
                    const dateObj = new Date(d.date);
                    const isOverdue = dateObj < now;
                    const isUpcoming = !isOverdue && dateObj.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
                    return (
                      <div key={d.id} className={`flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 ${isOverdue ? "bg-red-50" : isUpcoming ? "bg-amber-50" : "bg-[var(--surface)]"}`}>
                        <div>
                          <span className={`text-sm font-medium ${isOverdue ? "text-red-700" : isUpcoming ? "text-amber-700" : "text-[var(--text)]"}`}>{d.label}</span>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">{d.date}</span>
                          {d.description && <div className="mt-0.5 text-xs text-[var(--text-muted)]">{d.description}</div>}
                          {isOverdue && <span className="ml-2 text-[10px] font-medium text-red-600">OVERDUE</span>}
                          {isUpcoming && <span className="ml-2 text-[10px] font-medium text-amber-600">UPCOMING</span>}
                        </div>
                        <button type="button" onClick={() => removeKeyDate(d.id)} className="p-1 text-[var(--text-faint)] hover:text-[var(--danger)]">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <div className="text-xs font-medium text-[var(--text-muted)]">Add Key Date</div>
                <input value={dateForm.label} onChange={(e) => setDateForm({ ...dateForm, label: e.target.value })} placeholder="Label (e.g. Hearing)" className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <input type="date" value={dateForm.date} onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })} className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <input value={dateForm.description} onChange={(e) => setDateForm({ ...dateForm, description: e.target.value })} placeholder="Description (optional)" className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <button type="button" onClick={addKeyDate} disabled={!dateForm.label || !dateForm.date} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50">
                  Add Date
                </button>
              </div>
            </div>

            {/* Related Matters */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-5">
              <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                <Link2 className="h-4 w-4" /> Related Matters ({matter.relatedMatters.length})
              </h3>
              {matter.relatedMatters.length > 0 && (
                <div className="mt-3 space-y-2">
                  {matter.relatedMatters.map((rmId) => {
                    const rm = matters.find((m) => m.id === rmId);
                    if (!rm) return null;
                    return (
                      <div key={rmId} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-2">
                        <button type="button" onClick={() => router.push(`/matters/${rmId}`)} className="text-left">
                          <div className="text-sm font-medium text-[var(--text)]">{rm.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{rm.client} · {rm.status}</div>
                        </button>
                        <button type="button" onClick={() => unlinkRelatedMatter(rmId)} className="p-1 text-[var(--text-faint)] hover:text-[var(--danger)]">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setRelatedPickerOpen(true)}
                className="mt-3 flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
              >
                <Plus className="h-3 w-3" /> Link Matter
              </button>
            </div>

            {/* AI Tools card */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-5">
              <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                <Sparkles className="h-4 w-4" /> AI Tools
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Attach documents to unlock AI-powered analysis.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={extractDates} disabled={extractDatesLoading} className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-40">
                  <Calendar className="h-3 w-3" /> {extractDatesLoading ? "Extracting..." : "Extract Dates"}
                </button>
                <button type="button" onClick={identifyParties} disabled={identifyPartiesLoading} className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-40">
                  <Users className="h-3 w-3" /> {identifyPartiesLoading ? "Identifying..." : "Identify Parties"}
                </button>
                <button type="button" onClick={draftTimeline} disabled={draftTimelineLoading} className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-40">
                  <Clock className="h-3 w-3" /> {draftTimelineLoading ? "Drafting..." : "Draft Timeline"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================== DOCUMENTS ======================== */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80"
              >
                <Upload className="h-3.5 w-3.5" /> Upload Document
              </button>
              <button
                type="button"
                onClick={() => setDocumentPickerOpen(true)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
              >
                Link from Vault
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" multiple onChange={handleDirectUpload} className="hidden" />
            </div>
            {linkedDocuments.length === 0 ? (
              <EmptyState icon={<FolderOpen className="h-8 w-8 text-[var(--text-faint)]" />} title="No documents linked to this matter" button="Upload Document" onClick={() => fileInputRef.current?.click()} />
            ) : (
              <div className="grid gap-3">
                {linkedDocuments.map((doc) => (
                  <div key={doc.id} className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">{doc.filename}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatBytes(doc.sizeBytes)} · Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedDocs = links.documents.filter((id) => id !== doc.id);
                        persistLinks({ ...links, documents: updatedDocs });
                        updateMatter((m) => m, "document", `Document unlinked: ${doc.filename}`);
                      }}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--surface)] hover:text-[var(--danger)] group-hover:opacity-100"
                      title="Unlink document"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================== THREADS ======================== */}
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
                Start new thread
              </button>
              <button type="button" onClick={() => setChatPickerOpen(true)} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
                Link existing chat
              </button>
            </div>
            {linkedChats.length === 0 ? (
              <EmptyState title="No conversations linked to this matter" button="Link existing chat" onClick={() => setChatPickerOpen(true)} />
            ) : (
              <div className="grid gap-2">
                {linkedChats.map((chat) => (
                  <div key={chat.id} className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4 hover:bg-[var(--sidebar-bg)]">
                    <button type="button" onClick={() => router.push(`/c/${chat.id}`)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-medium text-[var(--text)]">{chat.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{new Date(chat.updatedAt).toLocaleDateString()}</div>
                    </button>
                    <button type="button" onClick={() => persistLinks({ ...links, chats: links.chats.filter((c) => c !== chat.id) })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================== CONTRACT SCANS ======================== */}
        {activeTab === "scans" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => router.push(`/contract-scanner?matter=${matter.id}`)} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80">
                Scan a contract
              </button>
              <button type="button" onClick={() => setScanPickerOpen(true)} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
                Link existing scan
              </button>
            </div>
            {linkedScans.length === 0 ? (
              <EmptyState title="No contract scans for this matter" button="Link existing scan" onClick={() => setScanPickerOpen(true)} />
            ) : (
              <div className="grid gap-3">
                {linkedScans.map((scan) => {
                  const analysis = parseScanReportContent(scan);
                  const counts = getRiskCounts(analysis?.clauses || []);
                  return (
                    <div key={scan.id} className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4 hover:bg-[var(--sidebar-bg)]">
                      <button type="button" onClick={() => router.push(`/contract-scanner?report=${encodeURIComponent(scan.id)}`)} className="min-w-0 flex-1 text-left">
                        <div className="text-sm font-medium text-[var(--text)]">{scan.filename}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {scan.overallRisk || analysis?.overall_risk || "Risk pending"} · {counts.high} High · {counts.medium} Medium · {counts.standard} Standard
                        </div>
                      </button>
                      <button type="button" onClick={() => persistLinks({ ...links, scans: links.scans.filter((s) => s !== scan.id) })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================== TIMELINE ======================== */}
        {activeTab === "timeline" && (
          <div>
            {matter.timeline.length === 0 ? (
              <EmptyState icon={<Clock className="h-8 w-8 text-[var(--text-faint)]" />} title="No activity yet" button="Start by adding a document" onClick={() => setActiveTab("documents")} />
            ) : (
              <div className="relative border-l-2 border-[var(--border)] pl-6">
                {matter.timeline.map((entry) => {
                  const Icon = TIMELINE_ICONS[entry.type] || Clock;
                  return (
                    <div key={entry.id} className="relative mb-4 pb-4">
                      <div className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)]">
                        <Icon className="h-3 w-3 text-[var(--text-muted)]" />
                      </div>
                      <div className="text-xs text-[var(--text-faint)]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--text)]">{entry.description}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================== NOTES ======================== */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] py-2 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none"
                />
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
              <div className="text-xs font-medium text-[var(--text-muted)]">{editingNoteId ? "Edit Note" : "New Note"}</div>
              <input
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Title"
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none"
              />
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Write your note..."
                rows={4}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={saveNote} disabled={!noteForm.title.trim()} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50">
                  {editingNoteId ? "Update Note" : "Add Note"}
                </button>
                {editingNoteId && (
                  <button type="button" onClick={() => { setEditingNoteId(null); setNoteForm({ title: "", content: "" }); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <EmptyState icon={<StickyNote className="h-8 w-8 text-[var(--text-faint)]" />} title="No notes yet" button="Add your first note" onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Title"]')?.focus()} />
            ) : (
              <div className="grid gap-3">
                {filteredNotes.map((note) => (
                  <div key={note.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-[var(--text)]">{note.title}</div>
                        <div className="text-xs text-[var(--text-faint)]">{new Date(note.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => { setEditingNoteId(note.id); setNoteForm({ title: note.title, content: note.content }); }} className="p-1 text-[var(--text-faint)] hover:text-[var(--text)]">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => deleteNote(note.id)} className="p-1 text-[var(--text-faint)] hover:text-[var(--danger)]">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-muted)]">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================== BILLING ======================== */}
        {activeTab === "billing" && (
          <div className="space-y-4">
            {matter.billingEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Total Fees</div>
                  <div className="text-xl font-medium text-[var(--text)]">{getCurrencyForJurisdiction(matter.jurisdiction)} {totalBillingFees(matter.billingEntries).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Total Hours</div>
                  <div className="text-xl font-medium text-[var(--text)]">{totalBillingHours(matter.billingEntries).toFixed(1)}h</div>
                </div>
                <button type="button" onClick={exportBillingCSV} className="ml-auto flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--bg)]">
                  <Download className="h-3 w-3" /> Export CSV
                </button>
              </div>
            )}

            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
              <div className="text-xs font-medium text-[var(--text-muted)]">Log Time Entry</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <BillingCalendar value={billingForm.date} onChange={(date) => setBillingForm({ ...billingForm, date })} />
                <input value={billingForm.description} onChange={(e) => setBillingForm({ ...billingForm, description: e.target.value })} placeholder="Description" className="min-w-[200px] flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <input type="number" step="0.1" value={billingForm.hours} onChange={(e) => setBillingForm({ ...billingForm, hours: e.target.value })} placeholder="Hours" className="w-20 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <input type="number" step="1" value={billingForm.rate} onChange={(e) => setBillingForm({ ...billingForm, rate: e.target.value })} placeholder="Rate" className="w-28 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                <button type="button" onClick={addBillingEntry} disabled={!billingForm.date || !billingForm.description || !billingForm.hours} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--bg-primary)] hover:opacity-80 disabled:opacity-50">
                  Add
                </button>
              </div>
            </div>

            {matter.billingEntries.length === 0 ? (
              <EmptyState icon={<Receipt className="h-8 w-8 text-[var(--text-faint)]" />} title="No billing entries yet" button="Log time" onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Description"]')?.focus()} />
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
                <div className="grid grid-cols-[1fr_2fr_80px_100px_100px_40px] border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
                  <div>Date</div>
                  <div>Description</div>
                  <div>Hours</div>
                  <div>Rate</div>
                  <div>Amount</div>
                  <div />
                </div>
                {matter.billingEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_2fr_80px_100px_100px_40px] items-center border-b border-[var(--border)] px-4 py-2 text-xs last:border-b-0">
                    <div className="text-[var(--text-muted)]">{entry.date}</div>
                    <div className="text-[var(--text)]">{entry.description}</div>
                    <div className="text-[var(--text-muted)]">{entry.hours}h</div>
                    <div className="text-[var(--text-muted)]">{getCurrencyForJurisdiction(matter.jurisdiction)} {entry.rate}</div>
                    <div className="font-medium text-[var(--text)]">{getCurrencyForJurisdiction(matter.jurisdiction)} {(entry.hours * entry.rate).toFixed(2)}</div>
                    <div>
                      <button type="button" onClick={() => removeBillingEntry(entry.id)} className="p-1 text-[var(--text-faint)] hover:text-[var(--danger)]">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ======================== MODALS ======================== */}

      <AddDocumentsModal
        open={documentPickerOpen}
        onClose={() => setDocumentPickerOpen(false)}
        onSelect={(selectedDocs) => {
          const newIds = selectedDocs.map((d) => d.id);
          persistLinks({ ...links, documents: Array.from(new Set([...links.documents, ...newIds])) });
          selectedDocs.forEach((d) => updateMatter((m) => m, "document", `Document linked: ${d.filename}`));
          setDocumentPickerOpen(false);
        }}
        breadcrumb={["Matters", matter.name, "Link Documents"]}
      />

      <PickerModal
        open={chatPickerOpen}
        title="Link existing chat"
        emptyMessage="No chat history found."
        onClose={() => setChatPickerOpen(false)}
      >
        {Object.values(chats ?? {}).map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => {
              persistLinks({ ...links, chats: Array.from(new Set([...links.chats, chat.id])) });
              updateMatter((m) => m, "chat", `Chat linked: ${chat.title}`);
              setChatPickerOpen(false);
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left hover:bg-[var(--sidebar-bg)]"
          >
            <div className="text-sm font-medium text-[var(--text)]">{chat.title}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{new Date(chat.updatedAt).toLocaleDateString()}</div>
          </button>
        ))}
      </PickerModal>

      <PickerModal
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
              updateMatter((m) => m, "scan", `Scan linked: ${scan.filename}`);
              setScanPickerOpen(false);
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left hover:bg-[var(--sidebar-bg)]"
          >
            <div className="text-sm font-medium text-[var(--text)]">{scan.filename}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{new Date(scan.date).toLocaleDateString()} · {scan.overallRisk || "Risk pending"}</div>
          </button>
        ))}
      </PickerModal>

      {/* Related matters picker */}
      <PickerModal
        open={relatedPickerOpen}
        title="Link related matter"
        emptyMessage="No other matters available."
        onClose={() => { setRelatedPickerOpen(false); setRelatedSearch(""); }}
      >
        <div className="mb-3">
          <input
            value={relatedSearch}
            onChange={(e) => setRelatedSearch(e.target.value)}
            placeholder="Search matters..."
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none"
            autoFocus
          />
        </div>
        {availableRelated.map((rm) => (
          <button
            key={rm.id}
            type="button"
            onClick={() => linkRelatedMatter(rm.id)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left hover:bg-[var(--sidebar-bg)]"
          >
            <div className="text-sm font-medium text-[var(--text)]">{rm.name}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{rm.client} · {rm.status}</div>
          </button>
        ))}
      </PickerModal>

      {/* Draft timeline modal */}
      {draftTimelineResult !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={() => setDraftTimelineResult(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--bg)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="text-base font-medium text-[var(--text)]">Draft Timeline</div>
              <button type="button" onClick={() => setDraftTimelineResult(null)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Close</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">{draftTimelineResult}</pre>
            </div>
            <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(draftTimelineResult).then(
                    () => toast.success("Timeline copied to clipboard"),
                    () => toast.error("Could not access clipboard")
                  );
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface)]"
              >
                Copy as text
              </button>
              <button type="button" onClick={() => setDraftTimelineResult(null)} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--bg-primary)] hover:opacity-80">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline icons                                                     */
/* ------------------------------------------------------------------ */

const TIMELINE_ICONS: Record<TimelineEntry["type"], typeof Clock> = {
  document: FileText,
  chat: MessageSquare,
  scan: FileText,
  note: StickyNote,
  date: Calendar,
  status: Briefcase,
  party: Users,
  billing: Receipt,
  summary: Sparkles,
  export: Download,
};

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function PickerModal({
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
      <div className="max-h-[70vh] w-full max-w-xl overflow-hidden rounded-2xl bg-[var(--bg)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

function EmptyState({ icon, title, button, onClick }: { icon?: React.ReactNode; title: string; button: string; onClick: () => void }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-center">
      {icon || <FileText className="h-8 w-8 text-[var(--text-faint)]" />}
      <p className="mt-3 text-sm text-[var(--text-muted)]" style={{ fontFamily: "var(--font-body)" }}>{title}</p>
      <button type="button" onClick={onClick} className="mt-4 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80">
        {button}
      </button>
    </div>
  );
}
