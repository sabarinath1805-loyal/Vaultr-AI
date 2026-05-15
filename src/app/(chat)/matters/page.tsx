"use client";

import { useEffect, useState } from "react";
import { Briefcase, MoreHorizontal, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getFixedDropdownPosition, type DropdownPosition } from "@/lib/dropdown-position";
import { generateUUID } from "@/lib/utils";
import {
  MATTER_STATUSES,
  MATTER_TYPES,
  Matter,
  readMatters,
  writeMatters,
} from "@/lib/matters";

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<DropdownPosition | null>(null);
  const [deleteMatterId, setDeleteMatterId] = useState<string | null>(null);
  const router = useRouter();
  const deleteMatterTarget = matters.find((matter) => matter.id === deleteMatterId) || null;

  useEffect(() => {
    setMatters(readMatters());
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-matter-actions]")) {
        return;
      }
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

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-start justify-between px-6 pb-6 pt-8">
        <div>
          <h1 className="font-display text-[28px] font-normal text-[var(--text)]">
            Matters
          </h1>
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

      <div className="px-6">
        {matters.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border)] p-12 text-center">
            <Briefcase className="h-8 w-8 text-[var(--text-faint)]" />
            <p className="font-display mt-3 text-[28px] font-normal text-[var(--text)]">No matters yet</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-[background-color] duration-150 hover:opacity-80"
            >
              + New Matter
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_80px] border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
              <div>Name</div>
              <div>Client</div>
              <div>Type</div>
              <div>Status</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            {matters.map((matter) => (
              <MatterRow
                key={matter.id}
                matter={matter}
                menuOpen={openMenuId === matter.id}
                onOpen={() => router.push(`/matters/${matter.id}`)}
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
  onToggleMenu,
  onEdit,
  onDelete,
}: {
  matter: Matter;
  menuOpen: boolean;
  menuPosition: DropdownPosition | null;
  onOpen: () => void;
  onToggleMenu: (button: HTMLButtonElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="grid cursor-pointer grid-cols-[1.3fr_1fr_1fr_1fr_1fr_80px] items-center border-b border-[var(--border)] px-4 py-3 text-[13px] last:border-b-0 hover:bg-[var(--sidebar-bg)]"
      onClick={onOpen}
    >
      <div className="font-medium text-[var(--text)]">{matter.name}</div>
      <div className="text-[var(--text-muted)]">{matter.client || "—"}</div>
      <div className="text-[var(--text-muted)]">{matter.type}</div>
      <div className="text-[var(--text-muted)]">{matter.status}</div>
      <div className="text-[var(--text-muted)]">
        {new Date(matter.createdAt).toLocaleDateString()}
      </div>
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
            style={{
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left ?? 0,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Open
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--surface)]"
            >
              Delete
            </button>
          </div>
        )}
      </div>
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
        <h2 className="font-display text-[28px] font-normal">Delete {name}?</h2>
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

function NewMatterModal({
  onClose,
  onCreate,
  matter,
}: {
  onClose: () => void;
  onCreate: (matter: Matter) => void;
  matter?: Matter | null;
}) {
  const [name, setName] = useState(matter?.name || "");
  const [client, setClient] = useState(matter?.client || "");
  const [type, setType] = useState<Matter["type"]>(matter?.type || "Litigation");
  const [status, setStatus] = useState<Matter["status"]>(matter?.status || "Active");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)]" onClick={onClose}>
      <form
        className="w-[400px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_8px_32px_var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
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
          });
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[28px] font-normal text-[var(--text)]">
            {matter ? "Edit Matter" : "New Matter"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface)]" aria-label="Close new matter">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-5 block text-xs font-medium text-[var(--text-muted)]">
          Matter name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
            autoFocus
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Matter["status"])}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
          >
            {MATTER_STATUSES.map((matterStatus) => (
              <option key={matterStatus}>{matterStatus}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Client name
          <input
            value={client}
            onChange={(event) => setClient(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
          Matter type
          <select
            value={type}
            onChange={(event) => setType(event.target.value as Matter["type"])}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
          >
            {MATTER_TYPES.map((matterType) => (
              <option key={matterType}>{matterType}</option>
            ))}
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface)]">
            Cancel
          </button>
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] text-[var(--bg-primary)] hover:opacity-80">
            {matter ? "Save Matter" : "Create Matter"}
          </button>
        </div>
      </form>
    </div>
  );
}
