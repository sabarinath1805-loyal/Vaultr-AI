"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isLexModel } from "@/lib/models";
import useChatStore from "@/app/hooks/useChatStore";

interface RemoveState {
  removing: boolean;
  error: string | null;
}

const activeModelPulls = new Map<string, AbortController>();

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
    badge: "Flash",
    tierName: "Lex Flash",
    tierDescription: "Fastest local model for quick legal Q&A.",
    color: "#1D9E75",
    models: [
      { id: "gemma4:e2b", tierName: "Lex Flash (Private)", badge: "Flash", color: "#1D9E75", ram: "2.6GB", description: "Fastest, lightest local model." },
    ],
  },
  {
    badge: "Core",
    tierName: "Lex Core",
    tierDescription: "Balanced speed and legal reasoning for daily work.",
    color: "#378ADD",
    models: [
      { id: "phi4-mini", tierName: "Lex Core (Private)", badge: "Core", color: "#378ADD", ram: "3.8GB", description: "Balanced local model for everyday legal queries." },
    ],
  },
  {
    badge: "Pro",
    tierName: "Lex Pro",
    tierDescription: "Stronger models for deep clause analysis.",
    color: "#7F77DD",
    models: [
      { id: "qwen3:8b", tierName: "Lex Pro (Private)", badge: "Pro", color: "#7F77DD", ram: "5.2GB", description: "Most capable local model for deep legal analysis." },
    ],
  },
];

const ALL_LOCAL_MODEL_IDS = MODEL_TIERS.flatMap((tier) =>
  tier.models.map((model) => model.id)
);

function formatModelSize(valueMb: number) {
  if (valueMb >= 1024) return `${(valueMb / 1024).toFixed(1)} GB`;
  return `${Math.round(valueMb)} MB`;
}

export default function ModelsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
  const [removals, setRemovals] = useState<Record<string, RemoveState>>({});
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const downloads = useChatStore((state) => state.modelDownloads);
  const setModelDownload = useChatStore((state) => state.setModelDownload);
  const clearModelDownload = useChatStore((state) => state.clearModelDownload);
  const selectedLocalModel = useMemo(() => {
    const preferredLexModel = ALL_LOCAL_MODEL_IDS.find(
      (modelId) =>
        modelId === defaultModelPreference && installedModels.includes(modelId)
    );
    const firstLexModel = preferredLexModel || ALL_LOCAL_MODEL_IDS.find((modelId) =>
      installedModels.includes(modelId)
    );

    if (
      selectedModel &&
      isLexModel(selectedModel) &&
      installedModels.includes(selectedModel)
    ) {
      return selectedModel;
    }

    return firstLexModel || null;
  }, [defaultModelPreference, installedModels, selectedModel]);

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

        const orderedModels = ALL_LOCAL_MODEL_IDS.filter((modelId) => modelIds.includes(modelId));

        if (!cancelled) {
          setInstalledModels((current) =>
            current.join("\u0000") === orderedModels.join("\u0000")
              ? current
              : orderedModels
          );
          setIsOllamaRunning(true);
        }
      } catch {
        if (!cancelled) {
          setInstalledModels((current) => (current.length === 0 ? current : []));
          setIsOllamaRunning(false);
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
    // Initial Ollama inventory load is isolated from selectedModel updates; a
    // separate guarded effect reconciles selection without refetching in a loop.
  }, []);

  useEffect(() => {
    if (cloudMode) return;
    if (selectedModel === selectedLocalModel) return;
    if (!selectedModel && !selectedLocalModel) return;
    setSelectedModel(selectedLocalModel);
    // This effect only writes when the derived local model actually changes, so
    // selectedModel updates cannot recurse through the models inventory effect.
  }, [cloudMode, selectedLocalModel, selectedModel, setSelectedModel]);

  const refreshModels = async () => {
    const response = await fetch("/api/tags");
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    const modelIds = Array.isArray(data?.models)
      ? data.models.map(({ name }: { name: string }) => name)
      : [];
    const orderedModels = ALL_LOCAL_MODEL_IDS.filter((modelId) => modelIds.includes(modelId));
    setInstalledModels((current) =>
      current.join("\u0000") === orderedModels.join("\u0000") ? current : orderedModels
    );
    setIsOllamaRunning(true);
  };

  const downloadModel = async (ollamaId: string, label: string) => {
    const controller = new AbortController();
    if (activeModelPulls.has(ollamaId)) return;
    activeModelPulls.set(ollamaId, controller);
    setModelDownload(ollamaId, {
      progress: 0,
      remainingMb: null,
      completedMb: null,
      totalMb: null,
      status: "Starting",
      error: null,
    });

    try {
      const response = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ollamaId }),
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
          const completedMb = total > 0 ? completed / 1024 / 1024 : null;
          const totalMb = total > 0 ? total / 1024 / 1024 : null;

          useChatStore.getState().setModelDownload(ollamaId, {
            progress: chunk.status === "success" ? 100 : progress,
            remainingMb,
            completedMb,
            totalMb,
            status: chunk.status || "Downloading",
            error: null,
          });

          if (chunk.status === "success") {
            setInstalledModels((models) =>
              models.includes(ollamaId)
                ? models
                : ALL_LOCAL_MODEL_IDS.filter((modelId) => [...models, ollamaId].includes(modelId))
            );
            useChatStore.getState().clearModelDownload(ollamaId);
            activeModelPulls.delete(ollamaId);
            setSelectedModel(ollamaId);
            window.dispatchEvent(new Event("vaultr-models-updated"));
            toast.success(`${label} installed successfully`);
            await refreshModels().catch(() => undefined);
            return;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        useChatStore.getState().clearModelDownload(ollamaId);
        activeModelPulls.delete(ollamaId);
        return;
      }

      useChatStore.getState().setModelDownload(ollamaId, {
        ...(useChatStore.getState().modelDownloads[ollamaId] || {
          progress: 0,
          remainingMb: null,
          completedMb: null,
          totalMb: null,
          status: "",
        }),
        error: "Download failed. Make sure Ollama is running and try again.",
      });
      activeModelPulls.delete(ollamaId);
    }
  };

  const cancelDownload = (ollamaId: string) => {
    activeModelPulls.get(ollamaId)?.abort();
    clearModelDownload(ollamaId);
    activeModelPulls.delete(ollamaId);
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

        <div className="grid grid-cols-3 gap-6 max-w-5xl">
          {MODEL_TIERS.flatMap((tier) => tier.models).map((model) => {
                  const installed = installedModels.includes(model.id);
                  const download = downloads[model.id];
                  const removal = removals[model.id];
                  return (
                    <article
                      key={model.id}
                      className="min-h-[280px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-6"
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

                      <div className="mt-6 text-xs font-medium text-[var(--text-muted)]">
                        {model.ram}
                      </div>
                      <p className="mt-4 min-h-[48px] text-[13px] leading-relaxed text-[var(--text)]">
                        {model.description}
                      </p>

                      <div className="mt-6 flex items-center gap-3">
                        {installed ? (
                          <>
                            <button
                              type="button"
                              disabled={selectedModel === model.id}
                              onClick={() => setSelectedModel(model.id)}
                              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)] disabled:cursor-default disabled:bg-[var(--surface)]"
                            >
                              {selectedModel === model.id ? "✓ Installed" : "Use Model"}
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
                              {download.completedMb != null && download.totalMb != null
                                ? `${formatModelSize(download.completedMb)} / ${formatModelSize(download.totalMb)} — ${download.progress}%`
                                : `Downloading... ${download.progress}%`}
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
                            {isOllamaRunning ? "Install" : "Start Ollama first"}
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
      </div>
    </main>
  );
}
