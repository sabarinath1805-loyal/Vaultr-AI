"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LEX_MODELS } from "@/lib/models";
import useChatStore from "@/app/hooks/useChatStore";

interface DownloadState {
  progress: number;
  remainingMb: number | null;
  status: string;
  error: string | null;
  controller: AbortController;
}

export default function ModelsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);

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
  }, []);

  const refreshModels = async () => {
    const response = await fetch("/api/tags");
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    const modelIds = Array.isArray(data?.models)
      ? data.models.map(({ name }: { name: string }) => name)
      : [];
    setInstalledModels(modelIds);
    setIsOllamaRunning(true);
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

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-semibold text-[var(--text)]">Models</h1>
        <p className="mb-8 mt-1 text-[13px] text-[var(--text-muted)]">
          Manage your local Lex models. All models run 100% on your device.
        </p>

        {!isOllamaRunning && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[rgb(229,62,62)] bg-[rgb(255,240,240)] px-4 py-3 text-[13px] text-[rgb(197,48,48)]">
            Ollama is not running. Start Ollama to manage and use Lex models.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {LEX_MODELS.map((model) => {
            const installed = installedModels.includes(model.ollamaId);
            const download = downloads[model.ollamaId];
            return (
              <article
                key={model.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-6 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-xl leading-none text-[var(--text)]">
                    {model.name}
                  </h2>
                  <span className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">
                    {model.tier}
                  </span>
                </div>

                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  {model.ram} RAM · {model.size}
                </div>
                <p className="mt-2 text-[13px] text-[var(--text)]">
                  {model.description}
                </p>

                <div className="mt-5 space-y-3">
                  <CapabilityBar label="Speed" value={model.speed} />
                  <CapabilityBar label="Reasoning" value={model.reasoning} />
                  <CapabilityBar label="Legal Depth" value={model.legalDepth} />
                </div>

                <div className="mt-5 flex items-center gap-3">
                  {installed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedModel(model.ollamaId)}
                        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)]"
                      >
                        {selectedModel === model.ollamaId ? "Using Model" : "Use Model"}
                      </button>
                      <button
                        type="button"
                        className="border-0 bg-transparent text-[13px] text-[rgb(229,62,62)] transition-[color,background-color] duration-150 hover:text-[rgb(197,48,48)]"
                      >
                        Remove
                      </button>
                    </>
                  ) : download && !download.error ? (
                    <div className="flex flex-col items-start">
                      <button
                        type="button"
                        className="rounded-[var(--radius-sm)] px-4 py-2 text-[13px] text-white transition-[color,background-color] duration-150"
                        style={{
                          background: `linear-gradient(90deg, #1a1916 ${download.progress}%, #8a8880 ${download.progress}%)`,
                        }}
                      >
                        Downloading... {download.progress}%
                        {download.remainingMb !== null
                          ? ` · ${download.remainingMb.toFixed(0)} MB left`
                          : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelDownload(model.ollamaId)}
                        className="mt-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!isOllamaRunning}
                      onClick={() => downloadModel(model.ollamaId, model.name)}
                      className="rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-[var(--bg)] transition-[color,background-color] duration-150 hover:bg-[rgb(51,51,51)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Download
                    </button>
                  )}
                </div>
                {download?.error && (
                  <div className="mt-3 text-[13px] text-[rgb(229,62,62)]">
                    {download.error}
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

function CapabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-[2px] bg-[var(--border)]">
        <div
          className="h-full rounded-[2px] bg-[var(--text)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
