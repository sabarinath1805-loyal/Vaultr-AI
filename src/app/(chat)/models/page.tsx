"use client";

import { useEffect, useState } from "react";
import { LEX_MODELS } from "@/lib/models";

export default function ModelsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);

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
          setIsOllamaRunning(modelIds.length > 0);
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
                        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)]"
                      >
                        Use Model
                      </button>
                      <button
                        type="button"
                        className="border-0 bg-transparent text-[13px] text-[rgb(229,62,62)] transition-[color,background-color] duration-150 hover:text-[rgb(197,48,48)]"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-[13px] text-[var(--bg)] transition-[color,background-color] duration-150 hover:bg-[rgb(51,51,51)]"
                    >
                      Download
                    </button>
                  )}
                </div>
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
