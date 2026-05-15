"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import { LEX_MODELS } from "@/lib/models";

type Tab = "general" | "ollama" | "privacy";

const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "ollama", label: "Ollama Settings" },
  { id: "privacy", label: "Privacy" },
];

const fieldClass =
  "flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--text-muted)]";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const router = useRouter();

  return (
    <main className="flex h-screen flex-col overflow-y-auto bg-[var(--bg)]">
      <header className="mx-auto flex h-16 w-full max-w-5xl shrink-0 items-end px-6 pb-2 md:h-24 md:pb-4">
        <div className="flex items-baseline gap-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="border-0 bg-transparent p-0 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            ← Back
          </button>
          <h1 className="font-display text-[28px] font-normal text-[var(--text)]">Settings</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10 pt-4 md:pt-6">
        <div className="grid grid-cols-1 gap-y-6 md:grid-cols-[224px_minmax(0,1fr)] md:gap-x-10">
          <nav aria-label="Settings" className="z-10 -ml-3 min-w-0 self-start md:sticky md:top-4">
            <ul className="flex gap-1 md:flex-col">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex h-9 w-full items-center whitespace-nowrap rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[var(--surface)] text-[var(--text)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--text)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "ollama" && <OllamaSettings />}
            {activeTab === "privacy" && <PrivacySettings />}
          </div>
        </div>
      </div>
    </main>
  );
}

function GeneralSettings() {
  const userName = useChatStore((state) => state.userName);
  const setUserName = useChatStore((state) => state.setUserName);
  const organisation = useChatStore((state) => state.organisation);
  const setOrganisation = useChatStore((state) => state.setOrganisation);
  const clearAllChats = useChatStore((state) => state.clearAllChats);
  const themePreference = useChatStore((state) => state.themePreference);
  const setThemePreference = useChatStore((state) => state.setThemePreference);
  const [displayName, setDisplayName] = useState(userName);
  const [orgDraft, setOrgDraft] = useState(organisation);
  const [nameSaved, setNameSaved] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Profile</h2>
        <div className="max-w-xl space-y-4">
          <div>
            <label className="mb-2 block text-sm text-[var(--text-muted)]">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={fieldClass}
                placeholder="Local User"
              />
              <SaveButton
                saved={nameSaved}
                disabled={!displayName.trim()}
                onClick={() => {
                  setUserName(displayName.trim());
                  setNameSaved(true);
                  setTimeout(() => setNameSaved(false), 1600);
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-[var(--text-muted)]">
              Organisation
            </label>
            <div className="flex gap-2">
              <input
                value={orgDraft}
                onChange={(event) => setOrgDraft(event.target.value)}
                className={fieldClass}
                placeholder="Optional"
              />
              <SaveButton
                saved={orgSaved}
                onClick={() => {
                  setOrganisation(orgDraft.trim());
                  setOrgSaved(true);
                  setTimeout(() => setOrgSaved(false), 1600);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-2 text-[28px] font-normal text-[var(--text)]">Usage Plan</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Solo ·{" "}
          <button type="button" className="underline underline-offset-2">
            Upgrade to Enterprise
          </button>
        </p>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Appearance</h2>
        <div className="inline-flex rounded-[8px] bg-[var(--surface-muted)] p-1">
          {(["light", "dark", "system"] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => setThemePreference(theme)}
              className={`rounded-[6px] px-4 py-2 text-sm font-medium capitalize transition-colors ${
                themePreference === theme
                  ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-2 text-[28px] font-normal text-[var(--text)]">Danger Zone</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Permanently delete all local Vaultr conversations.
        </p>
        <button
          type="button"
          onClick={() => setClearAllOpen(true)}
          className="rounded-[var(--radius-sm)] border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-bg)]"
        >
          Clear all conversations
        </button>
      </section>
      {clearAllOpen && (
        <ConfirmDeleteModal
          name="all conversations"
          onClose={() => setClearAllOpen(false)}
          onDelete={async () => {
            await clearAllChats();
            setClearAllOpen(false);
          }}
        />
      )}
    </div>
  );
}

function OllamaSettings() {
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const setOllamaUrl = useChatStore((state) => state.setOllamaUrl);
  const serperApiKey = useChatStore((state) => state.serperApiKey);
  const setSerperApiKey = useChatStore((state) => state.setSerperApiKey);
  const thinkingModeDefault = useChatStore((state) => state.thinkingModeDefault);
  const setThinkingModeDefault = useChatStore((state) => state.setThinkingModeDefault);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const setDefaultModelPreference = useChatStore((state) => state.setDefaultModelPreference);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const [ollamaDraft, setOllamaDraft] = useState(ollamaUrl);
  const [serperDraft, setSerperDraft] = useState(serperApiKey);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "down">("idle");
  const [serperSaved, setSerperSaved] = useState(false);

  const exportConversations = async () => {
    const response = await fetch("/api/chats", { cache: "no-store" });
    const data: { chats?: Record<string, unknown> } = await response.json();
    const chats = Object.values(data.chats || {});
    const blob = new Blob([JSON.stringify(chats, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vaultr-export-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">
          Ollama Connection
        </h2>
        <div className="max-w-xl">
          <label className="mb-2 block text-sm text-[var(--text-muted)]">
            Ollama URL
          </label>
          <div className="flex gap-2">
            <input
              value={ollamaDraft}
              onChange={(event) => setOllamaDraft(event.target.value)}
              className={fieldClass}
              placeholder="http://localhost:11434"
            />
            <button
              type="button"
              onClick={async () => {
                setOllamaUrl(ollamaDraft.trim() || "http://localhost:11434");
                try {
                  const response = await fetch("/api/tags", { cache: "no-store" });
                  setConnectionStatus(response.ok ? "connected" : "down");
                } catch {
                  setConnectionStatus("down");
                }
              }}
              className="min-w-[128px] rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:opacity-80"
            >
              Test Connection
            </button>
          </div>
          {connectionStatus !== "idle" && (
            <p
              className={`mt-2 flex items-center gap-1 text-sm ${
                connectionStatus === "connected"
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]"
              }`}
            >
              {connectionStatus === "connected" ? (
                <>
                  <Check className="h-4 w-4" /> Connected
                </>
              ) : (
                <>
                  <X className="h-4 w-4" /> Not running
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Web Search</h2>
        <div className="max-w-xl">
          <label className="mb-2 block text-sm text-[var(--text-muted)]">
            Serper API Key
          </label>
          <div className="flex gap-2">
            <input
              value={serperDraft}
              onChange={(event) => setSerperDraft(event.target.value)}
              className={fieldClass}
            />
            <SaveButton
              saved={serperSaved}
              onClick={() => {
                setSerperApiKey(serperDraft.trim());
                setSerperSaved(true);
                setTimeout(() => setSerperSaved(false), 1600);
              }}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Used to give Lex access to web search results.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Thinking Mode</h2>
        <button
          type="button"
          onClick={() => setThinkingModeDefault(!thinkingModeDefault)}
          className="flex max-w-xl items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-[var(--text)]">
              Enable thinking mode by default
            </span>
            <span className="mt-1 block text-sm text-[var(--text-muted)]">
              Shows Lex&apos;s reasoning process. Works with Lex Nano, Core, Pro, Elite and Max.
            </span>
          </span>
          <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${thinkingModeDefault ? "bg-[var(--text)]" : "bg-[var(--border)]"}`}>
            <span className={`h-4 w-4 rounded-full bg-[var(--bg)] transition-transform ${thinkingModeDefault ? "translate-x-4" : "translate-x-0"}`} />
          </span>
        </button>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Default Model</h2>
        <div className="max-w-xl space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-[var(--text-primary)]">
              Default Lex model
            </span>
            <select
              value={defaultModelPreference}
              onChange={(event) => {
                setDefaultModelPreference(event.target.value);
                setSelectedModel(event.target.value);
              }}
              className={fieldClass}
            >
              {LEX_MODELS.map((model) => (
                <option key={model.ollamaId} value={model.ollamaId}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">Data</h2>
        <div className="max-w-xl">
          <div className="text-sm text-[var(--text-primary)]">Export conversations</div>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Download all conversations as a JSON file.
          </p>
          <button
            type="button"
            onClick={exportConversations}
            className="mt-3 rounded-[6px] border border-[var(--text-primary)] px-4 py-[7px] text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            Export
          </button>
        </div>
      </section>
    </div>
  );
}

function PrivacySettings() {
  const autoCleanupConversations = useChatStore((state) => state.autoCleanupConversations);
  const setAutoCleanupConversations = useChatStore(
    (state) => state.setAutoCleanupConversations
  );

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">
          Data Storage
        </h2>
        <div className="space-y-1 text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          <p>All conversations and documents are stored locally on your device.</p>
          <p>
            Location: <span className="mono">~/Library/Application Support/Vaultr</span>
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">
          Auto-cleanup
        </h2>
        <ToggleRow
          label="Auto-delete conversations older than 30 days"
          enabled={autoCleanupConversations}
          onClick={() => setAutoCleanupConversations(!autoCleanupConversations)}
        />
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="font-display mb-4 text-[28px] font-normal text-[var(--text)]">
          Security
        </h2>
        <ToggleRow
          label="Require password on launch"
          enabled={false}
          disabled
          onClick={() => undefined}
        />
        <p className="mt-2 text-[13px] text-[var(--text-faint)]">
          Coming in Enterprise plan
        </p>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  disabled,
  onClick,
}: {
  label: string;
  enabled: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex max-w-xl items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
      <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${enabled ? "bg-[var(--text)]" : "bg-[var(--border)]"}`}>
        <span className={`h-4 w-4 rounded-full bg-[var(--bg)] transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function ConfirmDeleteModal({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
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

function SaveButton({
  saved,
  disabled,
  onClick,
}: {
  saved: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || saved}
      onClick={onClick}
      className="min-w-[80px] rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
