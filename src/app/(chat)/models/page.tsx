"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isLexModel } from "@/lib/models";
import useChatStore from "@/app/hooks/useChatStore";

interface DownloadState {
  progress: number;
  remainingMb: number | null;
  status: string;
  error: string | null;
  controller: AbortController;
}

interface RemoveState {
  removing: boolean;
  error: string | null;
}

interface IndividualModel {
  id: string;
  tierName: string;
  badge: string;
  color: string;
  ram: string;
  description: string;
}

const MODEL_TIERS: {
  badge: string;
  tierName: string;
  tierDescription: string;
  color: string;
  models: IndividualModel[];
}[] = [
  {
    badge: "SWIFT",
    tierName: "Lex Flash",
    tierDescription: "Fastest local models for quick legal Q&A.",
    color: "#1D9E75",
    models: [
      { id: "llama3.2:3b", tierName: "Lex Flash", badge: "SWIFT", color: "#1D9E75", ram: "2GB", description: "Fastest overall, best for quick Q&A" },
      { id: "gemma3:4b", tierName: "Lex Flash", badge: "SWIFT", color: "#1D9E75", ram: "3GB", description: "Strong reasoning at small size" },
      { id: "phi4-mini:3.8b", tierName: "Lex Flash", badge: "SWIFT", color: "#1D9E75", ram: "2.5GB", description: "Best reasoning per GB" },
    ],
  },
  {
    badge: "BALANCED",
    tierName: "Lex Core",
    tierDescription: "Balanced speed and legal reasoning for daily work.",
    color: "#378ADD",
    models: [
      { id: "qwen3:8b", tierName: "Lex Core", badge: "BALANCED", color: "#378ADD", ram: "5GB", description: "Best legal reasoning at 8B" },
      { id: "llama3.3:8b", tierName: "Lex Core", badge: "BALANCED", color: "#378ADD", ram: "6GB", description: "Best all-round balance" },
      { id: "mistral:7b", tierName: "Lex Core", badge: "BALANCED", color: "#378ADD", ram: "4.5GB", description: "Fastest in tier" },
    ],
  },
  {
    badge: "POWERFUL",
    tierName: "Lex Pro",
    tierDescription: "Stronger models for deep clause analysis.",
    color: "#7F77DD",
    models: [
      { id: "qwen3:14b", tierName: "Lex Pro", badge: "POWERFUL", color: "#7F77DD", ram: "9GB", description: "Strong legal reasoning" },
      { id: "mistral-nemo:12b", tierName: "Lex Pro", badge: "POWERFUL", color: "#7F77DD", ram: "7GB", description: "Long context 32K" },
      { id: "deepseek-r1:7b", tierName: "Lex Pro", badge: "POWERFUL", color: "#7F77DD", ram: "5GB", description: "Chain-of-thought reasoning" },
    ],
  },
  {
    badge: "SHARP",
    tierName: "Lex Advanced",
    tierDescription: "Advanced local reasoning for complex matters.",
    color: "#534AB7",
    models: [
      { id: "qwen3:30b", tierName: "Lex Advanced", badge: "SHARP", color: "#534AB7", ram: "18GB", description: "Best overall 2026" },
      { id: "deepseek-r1:14b", tierName: "Lex Advanced", badge: "SHARP", color: "#534AB7", ram: "9GB", description: "Best reasoning at this size" },
      { id: "gemma3:12b", tierName: "Lex Advanced", badge: "SHARP", color: "#534AB7", ram: "8GB", description: "Strong structured output" },
    ],
  },
  {
    badge: "DEEP",
    tierName: "Lex Elite",
    tierDescription: "Deep local analysis for litigation and diligence.",
    color: "#BA7517",
    models: [
      { id: "deepseek-r1:32b", tierName: "Lex Elite", badge: "DEEP", color: "#BA7517", ram: "18GB", description: "Best local reasoning" },
      { id: "qwen3:32b", tierName: "Lex Elite", badge: "DEEP", color: "#BA7517", ram: "18GB", description: "Deep legal analysis" },
    ],
  },
  {
    badge: "ELITE",
    tierName: "Lex Max",
    tierDescription: "Largest local models for near-frontier quality.",
    color: "#A32D2D",
    models: [
      { id: "llama4:scout", tierName: "Lex Max", badge: "ELITE", color: "#A32D2D", ram: "10GB", description: "MoE, near-frontier quality" },
      { id: "deepseek-r1:70b", tierName: "Lex Max", badge: "ELITE", color: "#A32D2D", ram: "40GB", description: "Best local reasoning available" },
    ],
  },
];

const ALL_LOCAL_MODEL_IDS = MODEL_TIERS.flatMap((tier) =>
  tier.models.map((model) => model.id)
);

export default function ModelsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [removals, setRemovals] = useState<Record<string, RemoveState>>({});
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const syncSelectedModel = useCallback((modelIds: string[]) => {
    const preferredLexModel = ALL_LOCAL_MODEL_IDS.find(
      (modelId) => modelId === defaultModelPreference && modelIds.includes(modelId)
    );
    const firstLexModel = preferredLexModel || ALL_LOCAL_MODEL_IDS.find((modelId) =>
      modelIds.includes(modelId)
    );

    if (!selectedModel && firstLexModel) {
      setSelectedModel(firstLexModel);
      return;
    }

    if (
      selectedModel &&
      (!isLexModel(selectedModel) || !modelIds.includes(selectedModel))
    ) {
      setSelectedModel(firstLexModel || null);
    }
  }, [defaultModelPreference, selectedModel, setSelectedModel]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        const modelIds = Array.isArray(data?.models)
          ? data.models.map(({ name }: { name: string }) => name)
          : [];

        if (!cancelled) {
          setInstalledModels(modelIds);
          setIsOllamaRunning(true);
          syncSelectedModel(modelIds);
        }
      } catch {
        if (!cancelled) {
          setInstalledModels([]);
          setIsOllamaRunning(false);
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [syncSelectedModel]);

  const refreshModels = async () => {
    const response = await fetch("/api/tags");
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    const modelIds = Array.isArray(data?.models)
      ? data.models.map(({ name }: { name: string }) => name)
      : [];
    setInstalledModels(modelIds);
    setIsOllamaRunning(true);
    syncSelectedModel(modelIds);
  };

  const downloadModel = async (ollamaId: string, label: string) => {
    const controller = new AbortController();
    setDownloads((state) => ({
      ...state,
      [ollamaId]: { progress: 0, remainingMb: null, status: "Starting", error: null, controller },
    }));

    try {
      const response = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ollamaId, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error("pull failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line) as {
            status?: string;
            total?: number;
            completed?: number;
          };
          const total = chunk.total || 0;
          const completed = chunk.completed || 0;
          const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
          const remainingMb =
            total > completed ? Math.max((total - completed) / 1024 / 1024, 0) : null;

          setDownloads((state) => ({
            ...state,
            [ollamaId]: {
              ...(state[ollamaId] || { controller }),
              controller,
              progress: chunk.status === "success" ? 100 : progress,
              remainingMb,
              status: chunk.status || "Downloading",
              error: null,
            },
          }));

          if (chunk.status === "success") {
            setInstalledModels((models) =>
              models.includes(ollamaId) ? models : [...models, ollamaId]
            );
            setDownloads((state) => {
              const next = { ...state };
              delete next[ollamaId];
              return next;
            });
            setSelectedModel(ollamaId);
            toast.success(`${label} installed successfully`);
            await refreshModels().catch(() => undefined);
            return;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setDownloads((state) => {
          const next = { ...state };
          delete next[ollamaId];
          return next;
        });
        return;
      }

      setDownloads((state) => ({
        ...state,
        [ollamaId]: {
          ...(state[ollamaId] || { controller, progress: 0, remainingMb: null, status: "" }),
          controller,
          error: "Download failed. Make sure Ollama is running and try again.",
        },
      }));
    }
  };

  const cancelDownload = (ollamaId: string) => {
    downloads[ollamaId]?.controller.abort();
  };

  const removeModel = async (ollamaId: string) => {
    setRemovals((state) => ({
      ...state,
      [ollamaId]: { removing: true, error: null },
    }));

    try {
      const response = await fetch("http://localhost:11434/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ollamaId }),
      });

      if (!response.ok) throw new Error("remove failed");

      const nextInstalled = installedModels.filter((modelId) => modelId !== ollamaId);
      setInstalledModels(nextInstalled);
      if (selectedModel === ollamaId) {
        const nextLexModelId = ALL_LOCAL_MODEL_IDS.find((modelId) =>
          nextInstalled.includes(modelId)
        );
        setSelectedModel(nextLexModelId || null);
      }
      setRemovals((state) => {
        const next = { ...state };
        delete next[ollamaId];
        return next;
      });
      window.dispatchEvent(new Event("vaultr-models-updated"));
      await refreshModels().catch(() => undefined);
    } catch {
      setRemovals((state) => ({
        ...state,
        [ollamaId]: { removing: false, error: "Remove failed. Try again." },
      }));
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)] px-6 py-8" style={{ paddingLeft: "2rem" }}>
      <div className="max-w-5xl">
        <h1 className="text-[28px] font-normal text-[var(--text)]">Models</h1>
        <p className="mb-8 mt-1 text-[13px] text-[var(--text-muted)]">
          Manage your local Lex models. All models run 100% on your device.
        </p>

        {!isOllamaRunning && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-3 text-[13px] text-[var(--danger-hover)]">
            Ollama is not running. Start Ollama to manage and use Lex models.
          </div>
        )}

        <div className="space-y-8">
          {MODEL_TIERS.map((tier) => (
            <section key={tier.badge}>
              <div style={{ marginBottom: "8px", marginTop: "24px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: tier.color, letterSpacing: "0.08em" }}>
                  {tier.badge}
                </span>
                <span style={{ fontSize: "13px", color: "#8a8880", marginLeft: "8px" }}>
                  {tier.tierDescription}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-5xl mx-auto mt-6">
                {tier.models.map((model) => {
                  const installed = installedModels.includes(model.id);
                  const download = downloads[model.id];
                  const removal = removals[model.id];
                  return (
                    <article
                      key={model.id}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-5 py-4"
                      style={{ borderTop: `3px solid ${model.color}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-[18px] font-semibold text-[var(--text)]">
                            {model.id}
                          </h2>
                          <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                            {model.tierName}
                          </div>
                        </div>
                        <span
                          style={{
                            backgroundColor: `${model.color}20`,
                            color: model.color,
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "3px 7px",
                            borderRadius: "20px",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {model.badge}
                        </span>
                      </div>

                      <div className="mt-4 text-xs font-medium text-[var(--text-muted)]">
                        {model.ram}
                      </div>
                      <p className="mt-2 min-h-[38px] text-[13px] text-[var(--text)]">
                        {model.description}
                      </p>

                      <div className="mt-5 flex items-center gap-3">
                        {installed ? (
                          <>
                            <button
                              type="button"
                              disabled={selectedModel === model.id}
                              onClick={() => setSelectedModel(model.id)}
                              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)] disabled:cursor-default disabled:bg-[var(--surface)]"
                            >
                              {selectedModel === model.id ? "Using Model" : "Use Model"}
                            </button>
                            <button
                              type="button"
                              disabled={removal?.removing}
                              onClick={() => removeModel(model.id)}
                              className="border-0 bg-transparent text-[13px] text-[var(--danger)] transition-[color,background-color] duration-150 hover:text-[var(--danger-hover)] disabled:opacity-60"
                            >
                              {removal?.removing ? "Removing..." : "Remove"}
                            </button>
                          </>
                        ) : download && !download.error ? (
                          <div className="flex flex-col items-start">
                            <button
                              type="button"
                              className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--white)] transition-[color,background-color] duration-150"
                              style={{
                                background: `linear-gradient(90deg, ${model.color} ${download.progress}%, var(--text-secondary) ${download.progress}%)`,
                              }}
                            >
                              Downloading... {download.progress}%
                              {download.remainingMb !== null
                                ? ` · ${download.remainingMb.toFixed(0)} MB left`
                                : ""}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelDownload(model.id)}
                              className="mt-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isOllamaRunning}
                            onClick={() => downloadModel(model.id, model.id)}
                            className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-[color,background-color] duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ backgroundColor: model.color }}
                          >
                            Download
                          </button>
                        )}
                      </div>
                      {download?.error && (
                        <div className="mt-3 text-[13px] text-[var(--danger)]">
                          {download.error}
                        </div>
                      )}
                      {removal?.error && (
                        <div className="mt-3 text-[13px] text-[var(--danger)]">
                          {removal.error}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
