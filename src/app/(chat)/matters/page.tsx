"use client";

import { useState } from "react";
import { Briefcase, X } from "lucide-react";
import { generateUUID } from "@/lib/utils";

interface Matter {
  id: string;
  name: string;
  client: string;
  type: "Litigation" | "Corporate" | "Real Estate" | "Employment" | "Other";
  createdAt: string;
}

const matterTypes: Matter["type"][] = [
  "Litigation",
  "Corporate",
  "Real Estate",
  "Employment",
  "Other",
];

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <h1 className="px-6 pb-4 pt-8 text-lg font-semibold text-[var(--text)]">
        Matters
      </h1>
      <p className="px-6 pb-6 text-[13px] text-[var(--text-muted)]">
        Manage your active legal matters and client files.
      </p>

      <div className="px-6">
        {matters.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border)] p-12 text-center">
            <Briefcase className="h-8 w-8 text-[var(--text-faint)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">No matters yet</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-white transition-[background-color] duration-150 hover:bg-[rgb(51,51,51)]"
            >
              + New Matter
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_120px] border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
              <div>Name</div>
              <div>Client</div>
              <div>Type</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            {matters.map((matter) => (
              <div
                key={matter.id}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr_120px] items-center border-b border-[var(--border)] px-4 py-3 text-[13px] last:border-b-0"
              >
                <div className="font-medium text-[var(--text)]">{matter.name}</div>
                <div className="text-[var(--text-muted)]">{matter.client || "—"}</div>
                <div className="text-[var(--text-muted)]">{matter.type}</div>
                <div className="text-[var(--text-muted)]">
                  {new Date(matter.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatters((current) => current.filter((item) => item.id !== matter.id))}
                    className="text-[rgb(229,62,62)] hover:text-[rgb(197,48,48)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewMatterModal
          onClose={() => setModalOpen(false)}
          onCreate={(matter) => {
            setMatters((current) => [matter, ...current]);
            setModalOpen(false);
          }}
        />
      )}
    </main>
  );
}

function NewMatterModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (matter: Matter) => void;
}) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState<Matter["type"]>("Litigation");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(0,0,0,0.3)]" onClick={onClose}>
      <form
        className="w-[400px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onCreate({
            id: generateUUID(),
            name: name.trim(),
            client: client.trim(),
            type,
            createdAt: new Date().toISOString(),
          });
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">New Matter</h2>
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
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
          >
            {matterTypes.map((matterType) => (
              <option key={matterType}>{matterType}</option>
            ))}
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface)]">
            Cancel
          </button>
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-white hover:bg-[#333]">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
