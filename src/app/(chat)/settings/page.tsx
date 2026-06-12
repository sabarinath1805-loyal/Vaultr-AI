"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useChatStore from "@/app/hooks/useChatStore";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import { ANTHROPIC_CORE_MODEL, GROQ_MODELS, LEX_MODELS } from "@/lib/models";
import { safeStorage } from "@/lib/safe-storage";
import { useAuth } from "@/components/auth/auth-provider";
import { isSupabaseConfigured, createBrowserSupabaseClient } from "@/lib/supabase";
import { resetOnboarding } from "@/components/onboarding/onboarding-modal";

type Tab = "account" | "appearance" | "lex" | "private-mode" | "data" | "usage";

const tabs: { id: Tab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "lex", label: "Lex" },
  { id: "private-mode", label: "Private Mode" },
  { id: "data", label: "Data" },
  { id: "usage", label: "Usage" },
];

const fieldClass =
  "flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--text-muted)]";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
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
          <h1 className="text-[28px] font-normal text-[var(--text)]">Settings</h1>
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
            {activeTab === "account" && <AccountSettings />}
            {activeTab === "appearance" && <AppearanceSettings />}
            {activeTab === "lex" && <LexSettings />}
            {activeTab === "private-mode" && <PrivateModeSettings />}
            {activeTab === "data" && <DataSettings />}
            {activeTab === "usage" && <UsageSettings />}
          </div>
        </div>
      </div>
    </main>
  );
}

function AccountSettings() {
  const { user, signOut } = useAuth();
  const supabaseEnabled = isSupabaseConfigured();

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Account</h2>
        <div className="max-w-xl space-y-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <p className="text-sm text-[var(--text)]">
            Vaultr Beta — Thank you for being an early access member.
          </p>
          {supabaseEnabled && user && (
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <p className="text-sm text-[var(--text-muted)]">
                Signed in as <span className="font-medium text-[var(--text)]">{user.email}</span>
              </p>
              <button
                type="button"
                onClick={signOut}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              >
                Sign out
              </button>
            </div>
          )}
          {supabaseEnabled && !user && (
            <p className="text-xs text-[var(--text-muted)]">
              Not signed in — auth is configured but no session detected.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function AppearanceSettings() {
  const themePreference = useChatStore((state) => state.themePreference);
  const setThemePreference = useChatStore((state) => state.setThemePreference);
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  useEffect(() => {
    const saved = safeStorage.getItem("vaultr-font-size");
    if (saved === "small" || saved === "medium" || saved === "large") setFontSize(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "small") root.style.fontSize = "14px";
    else if (fontSize === "large") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  }, [fontSize]);

  const changeFontSize = (size: "small" | "medium" | "large") => {
    setFontSize(size);
    safeStorage.setItem("vaultr-font-size", size);
  };

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Theme</h2>
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
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Font Size</h2>
        <div className="inline-flex rounded-[8px] bg-[var(--surface-muted)] p-1">
          {(["small", "medium", "large"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => changeFontSize(size)}
              className={`rounded-[6px] px-4 py-2 text-sm font-medium capitalize transition-colors ${
                fontSize === size
                  ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LexSettings() {
  const cloudMode = useChatStore((state) => state.cloudMode);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const setDefaultModelPreference = useChatStore((state) => state.setDefaultModelPreference);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);

  const defaultModelOptions = !cloudMode
    ? LEX_MODELS
        .filter(
          (model, index, models) =>
            models.findIndex((candidate) => candidate.ollamaId === model.ollamaId) === index
        )
        .map((model) => ({ value: model.ollamaId, label: model.name }))
    : GROQ_MODELS.map((model) => ({ value: model.groqId, label: model.name }));

  const defaultModelValue = defaultModelOptions.some(
    (option) => option.value === defaultModelPreference
  )
    ? defaultModelPreference
    : !cloudMode
    ? defaultModelOptions[0]?.value || ""
    : ANTHROPIC_CORE_MODEL;

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Default Model</h2>
        <div className="max-w-xl">
          <label className="block">
            <span className="mb-2 block text-sm text-[var(--text-muted)]">
              Select the default Lex model
            </span>
            <select
              value={defaultModelValue}
              onChange={(event) => {
                setDefaultModelPreference(event.target.value);
                setSelectedModel(event.target.value);
              }}
              className={fieldClass}
            >
              {defaultModelOptions.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Jurisdiction</h2>
        <div className="max-w-xl">
          <p className="text-sm text-[var(--text-muted)]">
            Lex automatically detects jurisdiction from your query keywords and routes searches to the most relevant legal databases.
          </p>
        </div>
      </section>
    </div>
  );
}

function PrivateModeSettings() {
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "down">("idle");

  const checkOllama = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`/api/tags`, {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      setConnectionStatus(response.ok ? "connected" : "down");
    } catch {
      setConnectionStatus("down");
    }
  };

  useEffect(() => {
    checkOllama();
  }, []);

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Ollama Status</h2>
        <div className="max-w-xl space-y-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3">
            <span
              className={`h-3 w-3 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "down"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            />
            <span className="text-sm text-[var(--text)]">
              {connectionStatus === "connected"
                ? "Ollama is running"
                : connectionStatus === "down"
                ? "Ollama is not running"
                : "Checking..."}
            </span>
            <span className="ml-auto text-xs text-[var(--text-faint)]">{ollamaUrl}</span>
          </div>
          <button
            type="button"
            onClick={checkOllama}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)]"
          >
            Refresh Status
          </button>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Install Guide</h2>
        <p className="text-sm text-[var(--text-muted)]">
          To use Private Mode, install Ollama on your machine:
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              const { open } = await import("@tauri-apps/plugin-shell");
              await open("https://ollama.com");
            } catch {
              window.open("https://ollama.com", "_blank");
            }
          }}
          className="mt-3 inline-block rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)]"
        >
          Download Ollama →
        </button>
      </section>
    </div>
  );
}

function DataSettings() {
  const clearAllChats = useChatStore((state) => state.clearAllChats);
  const [clearChatsConfirm, setClearChatsConfirm] = useState(false);
  const [clearVaultConfirm, setClearVaultConfirm] = useState(false);

  const exportConversations = async () => {
    const response = await fetch("/api/chats", { cache: "no-store" });
    const data: { chats?: Record<string, unknown> } = await response.json();
    const chats = Object.values(data.chats || {});
    const blob = new Blob([JSON.stringify(chats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vaultr-export-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearVault = () => {
    useLocalVaultStore.setState({ documents: [], projects: [] });
    setClearVaultConfirm(false);
  };

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Chat History</h2>
        {!clearChatsConfirm ? (
          <button
            type="button"
            onClick={() => setClearChatsConfirm(true)}
            className="rounded-[var(--radius-sm)] border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-bg)]"
          >
            Clear all conversations
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-muted)]">Are you sure?</span>
            <button
              type="button"
              onClick={async () => { await clearAllChats(); setClearChatsConfirm(false); }}
              className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-[var(--white)] hover:bg-[var(--danger-hover)]"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setClearChatsConfirm(false)}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Vault</h2>
        {!clearVaultConfirm ? (
          <button
            type="button"
            onClick={() => setClearVaultConfirm(true)}
            className="rounded-[var(--radius-sm)] border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-bg)]"
          >
            Clear Vault
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-muted)]">Are you sure? All documents will be deleted.</span>
            <button
              type="button"
              onClick={clearVault}
              className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-[var(--white)] hover:bg-[var(--danger-hover)]"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setClearVaultConfirm(false)}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Onboarding</h2>
        <p className="mb-3 text-sm text-[var(--text-muted)]">Re-run the onboarding tour to update your profile.</p>
        <button
          type="button"
          onClick={() => { resetOnboarding(); window.location.reload(); }}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          Reset Onboarding
        </button>
      </section>

      <section className="border-t border-[var(--border)] py-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Export</h2>
        <p className="mb-3 text-sm text-[var(--text-muted)]">Download all conversations as a JSON file.</p>
        <button
          type="button"
          onClick={exportConversations}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          Export All Data
        </button>
      </section>
    </div>
  );
}

interface UsageMetrics {
  totalThisMonth: number;
  totalToday: number;
  avgResponseTime: string;
  mostUsedModel: string;
  mostQueriedJurisdiction: string;
  documentsUploaded: number;
}

function UsageMetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function UsageSettings() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    const emptyMetrics: UsageMetrics = {
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "—",
      mostUsedModel: "—",
      mostQueriedJurisdiction: "—",
      documentsUploaded: 0,
    };

    if (!isSupabaseConfigured()) {
      setMetrics(emptyMetrics);
      setLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = {};
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch("/api/usage/stats", { headers });
      if (!response.ok) {
        setMetrics(emptyMetrics);
        setLoading(false);
        return;
      }

      const data: UsageMetrics = await response.json();
      setMetrics(data);
    } catch {
      setMetrics({
        totalThisMonth: 0,
        totalToday: 0,
        avgResponseTime: "—",
        mostUsedModel: "—",
        mostQueriedJurisdiction: "—",
        documentsUploaded: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="space-y-4">
      <section className="pb-6">
        <h2 className="mb-4 text-[28px] font-normal text-[var(--text)]">Usage</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Your query statistics and usage metrics.
        </p>
        {loading ? (
          <div className="text-[13px] text-[var(--text-muted)]">Loading usage data...</div>
        ) : metrics ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <UsageMetricCard label="Queries this month" value={metrics.totalThisMonth} />
            <UsageMetricCard label="Queries today" value={metrics.totalToday} />
            <UsageMetricCard label="Avg response time" value={metrics.avgResponseTime} />
            <UsageMetricCard label="Most used model" value={metrics.mostUsedModel} />
            <UsageMetricCard label="Top jurisdiction" value={metrics.mostQueriedJurisdiction} />
            <UsageMetricCard label="Documents uploaded" value={metrics.documentsUploaded} />
          </div>
        ) : (
          <div className="text-[13px] text-[var(--text-muted)]">No usage data available.</div>
        )}
      </section>
    </div>
  );
}
