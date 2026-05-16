"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LEX_MODELS, isLexModel } from "@/lib/models";
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

const MODEL_CARD_STYLES: Record<
  string,
  {
    accent: string;
    badge: string;
    badgeBackground: string;
    badgeColor: string;
  }
> = {
  "lex-nano": {
    accent: "#1D9E75",
    badge: "SWIFT",
    badgeBackground: "#E1F5EE",
    badgeColor: "#085041",
  },
  "lex-flash": {
    accent: "#1D9E75",
    badge: "SWIFT",
    badgeBackground: "#E1F5EE",
    badgeColor: "#085041",
  },
  "lex-core": {
    accent: "#378ADD",
    badge: "BALANCED",
    badgeBackground: "#E6F1FB",
    badgeColor: "#0C447C",
  },
  "lex-pro": {
    accent: "#7F77DD",
    badge: "POWERFUL",
    badgeBackground: "#EEEDFE",
    badgeColor: "#3C3489",
  },
  "lex-advanced": {
    accent: "#534AB7",
    badge: "SHARP",
    badgeBackground: "#EEEDFE",
    badgeColor: "#26215C",
  },
  "lex-elite": {
    accent: "#BA7517",
    badge: "DEEP",
    badgeBackground: "#FAEEDA",
    badgeColor: "#633806",
  },
  "lex-max": {
    accent: "#A32D2D",
    badge: "ELITE",
    badgeBackground: "#FCEBEB",
    badgeColor: "#791F1F",
  },
};

export default function ModelsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [removals, setRemovals] = useState<Record<string, RemoveState>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const syncSelectedModel = useCallback((modelIds: string[]) => {
    const allModelIds = LEX_MODELS.flatMap((model) => [
      model.ollamaId,
      ...(model.alternatives || []).map((alternative) => alternative.ollamaId),
    ]);
    const preferredLexModel = allModelIds.find(
      (modelId) => modelId === defaultModelPreference && modelIds.includes(modelId)
    );
    const firstLexModel = preferredLexModel || allModelIds.find((modelId) =>
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
        const nextLexModelId = LEX_MODELS.flatMap((model) => [
          model.ollamaId,
          ...(model.alternatives || []).map((alternative) => alternative.ollamaId),
        ]).find((modelId) => nextInstalled.includes(modelId));
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

        <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto mt-6">
          {LEX_MODELS.map((model) => {
            const selectedVariant = selectedVariants[model.id] || model.ollamaId;
            const installed = installedModels.includes(selectedVariant);
            const download = downloads[selectedVariant];
            const removal = removals[selectedVariant];
            const cardStyle = MODEL_CARD_STYLES[model.id];
            return (
              <article
                key={model.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-6 py-5"
                style={{ borderTop: `3px solid ${cardStyle.accent}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-[28px] font-normal text-[var(--text)]">
                    {model.name}
                  </h2>
                  <span
                    style={{
                      backgroundColor: cardStyle.badgeBackground,
                      color: cardStyle.badgeColor,
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "3px 8px",
                      borderRadius: "20px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {cardStyle.badge}
                  </span>
                </div>

                {model.alternatives && model.alternatives.length > 0 && (
                  <select
                    value={selectedVariant}
                    onChange={(event) =>
                      setSelectedVariants((state) => ({
                        ...state,
                        [model.id]: event.target.value,
                      }))
                    }
                    style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #e0ded8",
                      backgroundColor: "#fafaf8",
                      color: "#1a1916",
                      marginTop: "12px",
                      marginBottom: "8px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <option value={model.ollamaId}>{model.ollamaId} (default)</option>
                    {model.alternatives.map((alternative) => (
                      <option key={alternative.ollamaId} value={alternative.ollamaId}>
                        {alternative.label} — {alternative.ramSize}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  {model.ramRequired}
                </div>
                <p className="mt-2 text-[13px] text-[var(--text)]">
                  {model.description}
                </p>

                <div className="mt-5 space-y-3">
                  <CapabilityBar label="Speed" value={model.speed} color={cardStyle.accent} />
                  <CapabilityBar label="Reasoning" value={model.reasoning} color={cardStyle.accent} />
                  <CapabilityBar label="Legal Depth" value={model.legalDepth} color={cardStyle.accent} />
                </div>

                <div className="mt-5 flex items-center gap-3">
                  {installed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedModel(selectedVariant)}
                        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)]"
                      >
                        {selectedModel === selectedVariant ? "Using Model" : "Use Model"}
                      </button>
                      <button
                        type="button"
                        disabled={removal?.removing}
                        onClick={() => removeModel(selectedVariant)}
                        className="border-0 bg-transparent text-[13px] text-[var(--danger)] transition-[color,background-color] duration-150 hover:text-[var(--danger-hover)]"
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
                          background: `linear-gradient(90deg, ${cardStyle.accent} ${download.progress}%, var(--text-secondary) ${download.progress}%)`,
                        }}
                      >
                        Downloading... {download.progress}%
                        {download.remainingMb !== null
                          ? ` · ${download.remainingMb.toFixed(0)} MB left`
                          : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelDownload(selectedVariant)}
                        className="mt-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!isOllamaRunning}
                      onClick={() => downloadModel(selectedVariant, model.name)}
                      className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-[var(--bg-primary)] transition-[color,background-color] duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: cardStyle.accent }}
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
      </div>
    </main>
  );
}

function CapabilityBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-[2px] bg-[var(--border)]">
        <div
          className="h-full rounded-[2px]"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
