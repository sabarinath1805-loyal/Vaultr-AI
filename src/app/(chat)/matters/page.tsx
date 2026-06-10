"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Filter, MessageSquare, MoreHorizontal, Plus, Search, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import { generateUUID } from "@/lib/utils";
import { getFixedDropdownPosition, type DropdownPosition } from "@/lib/dropdown-position";
import {
  MATTER_STATUSES,
  MATTER_TYPES,
  type Matter,
  type MatterStatus,
  readMatters,
  writeMatters,
  writeMatterLinks,
  readMatterLinks,
  getUpcomingDatesCount,
  getOverdueDatesCount,
} from "@/lib/matters";

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<DropdownPosition | null>(null);
  const [deleteMatterId, setDeleteMatterId] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<MatterStatus | "All">("All");
  const [filterType, setFilterType] = useState<Matter["type"] | "All">("All");
  const [filterTag, setFilterTag] = useState<string | "All">("All");
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();
  const deleteMatterTarget = matters.find((matter) => matter.id === deleteMatterId) || null;

  useEffect(() => {
    setMatters(readMatters());
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-matter-actions]")) return;
      setOpenMenuId(null);
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

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    matters.forEach((m) => m.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [matters]);

  const filteredMatters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return matters.filter((m) => {
      if (filterStatus !== "All" && m.status !== filterStatus) return false;
      if (filterType !== "All" && m.type !== filterType) return false;
      if (filterTag !== "All" && !(m.tags || []).includes(filterTag)) return false;
      if (q) {
        const searchFields = [
          m.name,
          m.client,
          ...(m.tags || []),
          m.type,
          ...(m.parties || []).map((p) => p.name),
          ...(m.parties || []).map((p) => p.organisation),
        ].map((s) => (s || "").toLowerCase());
        if (!searchFields.some((f) => f.includes(q))) return false;
      }
      return true;
    });
  }, [matters, searchQuery, filterStatus, filterType, filterTag]);

  const persistMatters = (next: Matter[]) => {
    setMatters(next);
    writeMatters(next);
  };

  const openCreateModal = () => {
    setEditingMatter(null);
    setModalOpen(true);
  };

  const openEditModal = (matter: Matter) => {
    setEditingMatter(matter);
    setModalOpen(true);
    setOpenMenuId(null);
  };

  const openInLex = async (matter: Matter) => {
    const chatId = generateUUID();
    const links = readMatterLinks(matter.id);
    writeMatterLinks(matter.id, { ...links, chats: [...links.chats, chatId] });
    const chatStore = useChatStore.getState();
    await chatStore.saveMessages(chatId, [{
      id: generateUUID(),
      role: "assistant",
      content: `I have the context for **${matter.name}** (${matter.type}, ${matter.status}). ${matter.client ? `Client: ${matter.client}. ` : ""}What would you like to work on?`,
      createdAt: new Date(),
    }]);
    setOpenMenuId(null);
    router.push(`/c/${chatId}`);
  };

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-start justify-between px-6 pb-4 pt-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--text)]">Matters</h1>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">
            Manage your client matters and cases. Link documents, chats, and contract scans to each matter.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg-primary)] transition-colors hover:opacity-80"
          aria-label="New Matter"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="px-6 pb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 200))}
              maxLength={200}
              placeholder="Search matters, clients, tags, parties..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] py-2 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] transition-colors ${showFilters ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface)]"}`}
          >
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as MatterStatus | "All")}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
            >
              <option value="All">All Status</option>
              {MATTER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as Matter["type"] | "All")}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
            >
              <option value="All">All Types</option>
              {MATTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
              >
                <option value="All">All Tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {(filterStatus !== "All" || filterType !== "All" || filterTag !== "All") && (
              <button
                type="button"
                onClick={() => { setFilterStatus("All"); setFilterType("All"); setFilterTag("All"); }}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-6">
        {filteredMatters.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border)] p-12 text-center">
            <Briefcase className="h-8 w-8 text-[var(--text-faint)]" />
            <p className="mt-3 text-[28px] font-normal text-[var(--text)]" style={{ fontFamily: "var(--font-body)" }}>
              {searchQuery || filterStatus !== "All" || filterType !== "All" || filterTag !== "All" ? "No matching matters" : "No matters yet"}
            </p>
            {!searchQuery && filterStatus === "All" && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-[background-color] duration-150 hover:opacity-80"
              >
                + New Matter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
            <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.6fr_0.8fr_80px] border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
              <div>Name</div>
              <div>Client</div>
              <div>Type</div>
              <div>Status</div>
              <div>Dates</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            {filteredMatters.map((matter) => (
              <MatterRow
                key={matter.id}
                matter={matter}
                menuOpen={openMenuId === matter.id}
                onOpen={() => router.push(`/matters/${matter.id}`)}
                onOpenInLex={() => openInLex(matter)}
                onToggleMenu={(button) => {
                  if (openMenuId === matter.id) {
                    setOpenMenuId(null);
                    setMenuPosition(null);
                    return;
                  }
                  setMenuPosition(getFixedDropdownPosition(button, 120, 116));
                  setOpenMenuId(matter.id);
                }}
                menuPosition={menuPosition}
                onEdit={() => openEditModal(matter)}
                onDelete={() => {
                  setDeleteMatterId(matter.id);
                  setOpenMenuId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewMatterModal
          onClose={() => setModalOpen(false)}
          onCreate={(matter) => {
            persistMatters(editingMatter
              ? matters.map((item) => (item.id === matter.id ? matter : item))
              : [matter, ...matters]);
            setModalOpen(false);
          }}
          matter={editingMatter}
          allTags={allTags}
        />
      )}
      {deleteMatterTarget && (
        <ConfirmDeleteModal
          name={deleteMatterTarget.name}
          onClose={() => setDeleteMatterId(null)}
          onDelete={() => {
            persistMatters(matters.filter((item) => item.id !== deleteMatterTarget.id));
            setDeleteMatterId(null);
          }}
        />
      )}
    </main>
  );
}

function MatterRow({
  matter,
  menuOpen,
  menuPosition,
  onOpen,
  onOpenInLex,
  onToggleMenu,
  onEdit,
  onDelete,
}: {
  matter: Matter;
  menuOpen: boolean;
  menuPosition: DropdownPosition | null;
  onOpen: () => void;
  onOpenInLex: () => void;
  onToggleMenu: (button: HTMLButtonElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const upcoming = getUpcomingDatesCount(matter);
  const overdue = getOverdueDatesCount(matter);

  return (
    <div
      className="grid cursor-pointer grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.6fr_0.8fr_80px] items-center border-b border-[var(--border)] px-4 py-3 text-[13px] last:border-b-0 hover:bg-[var(--sidebar-bg)]"
      onClick={onOpen}
    >
      <div>
        <div className="font-medium text-[var(--text)]">{matter.name}</div>
        {(matter.tags || []).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {matter.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]">
                <Tag className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
            {matter.tags.length > 3 && <span className="text-[10px] text-[var(--text-faint)]">+{matter.tags.length - 3}</span>}
          </div>
        )}
      </div>
      <div className="text-[var(--text-muted)]">{matter.client || "—"}</div>
      <div className="text-[var(--text-muted)]">{matter.type}</div>
      <div className="text-[var(--text-muted)]">{matter.status}</div>
      <div>
        {overdue > 0 && <span className="mr-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">{overdue} overdue</span>}
        {upcoming > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{upcoming} soon</span>}
        {overdue === 0 && upcoming === 0 && <span className="text-[var(--text-faint)]">—</span>}
      </div>
      <div className="text-[var(--text-muted)]">{new Date(matter.createdAt).toLocaleDateString()}</div>
      <div className="relative flex items-center" data-matter-actions>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu(event.currentTarget);
          }}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          aria-label={`${matter.name} actions`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className="fixed z-50 min-w-[120px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_4px_12px_var(--shadow-soft)]"
            style={{ top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">Open</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenInLex(); }} className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">
              <MessageSquare className="h-3.5 w-3.5" /> Open in Lex
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]">Edit</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface)]">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ name, onClose, onDelete }: { name: string; onClose: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <div className="w-[400px] rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-[var(--text-primary)] shadow-[0_8px_32px_var(--shadow-modal)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[28px] font-normal">Delete {name}?</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">This cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Cancel</button>
          <button type="button" onClick={onDelete} className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2 text-[13px] font-medium text-[var(--white)] hover:bg-[var(--danger-hover)]">Delete</button>
        </div>
      </div>
    </div>
  );
}

function NewMatterModal({
  onClose,
  onCreate,
  matter,
  allTags,
}: {
  onClose: () => void;
  onCreate: (matter: Matter) => void;
  matter?: Matter | null;
  allTags: string[];
}) {
  const [name, setName] = useState(matter?.name || "");
  const [client, setClient] = useState(matter?.client || "");
  const [type, setType] = useState<Matter["type"]>(matter?.type || "Litigation");
  const [status, setStatus] = useState<MatterStatus>(matter?.status || "Active");
  const [tags, setTags] = useState<string[]>(matter?.tags || []);
  const [tagInput, setTagInput] = useState("");

  const addModalTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <form
        className="w-[400px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onCreate({
            id: matter?.id || generateUUID(),
            name: name.trim(),
            client: client.trim(),
            type,
            status,
            createdAt: matter?.createdAt || new Date().toISOString(),
            tags,
            keyDates: matter?.keyDates || [],
            parties: matter?.parties || [],
            notes: matter?.notes || [],
            relatedMatters: matter?.relatedMatters || [],
            billingEntries: matter?.billingEntries || [],
            summary: matter?.summary || "",
            timeline: matter?.timeline || [],
          });
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-normal text-[var(--text)]">{matter ? "Edit Matter" : "New Matter"}</h2>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-5 block text-xs font-medium text-[var(--text-muted)]">
          Matter name
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]" autoFocus />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as MatterStatus)} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]">
            {MATTER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Client name
          <input value={client} onChange={(e) => setClient(e.target.value)} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]" />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Matter type
          <select value={type} onChange={(e) => setType(e.target.value as Matter["type"])} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]">
            {MATTER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>

        {/* Tags */}
        <div className="mt-3">
          <div className="text-xs font-medium text-[var(--text-muted)]">Tags</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                {tag}
                <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModalTag(); } }}
              placeholder="Add tag..."
              list="existing-tags"
              className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] outline-none"
            />
            <datalist id="existing-tags">
              {allTags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}
            </datalist>
            <button type="button" onClick={addModalTag} className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border)]">+</button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface)]">Cancel</button>
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80">{matter ? "Save Matter" : "Create Matter"}</button>
        </div>
      </form>
    </div>
  );
}
