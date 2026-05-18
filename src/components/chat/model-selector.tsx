"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  GROQ_MODELS,
  GROQ_DEFAULT_MODEL,
  getModelDisplayMetadata,
  groqIdToLexName,
  isLexModel,
  ollamaIdToLexName,
  sortModelsByLexOrder,
} from "@/lib/models";
import useChatStore from "@/app/hooks/useChatStore";

interface ModelSelectorProps {
  disabled?: boolean;
  direction?: "up" | "down";
}

export function ModelSelector({ disabled, direction = "up" }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const router = useRouter();

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
        const orderedModels = sortModelsByLexOrder(modelIds.filter(isLexModel));

        if (!cancelled) {
          setIsOllamaRunning(true);
          setAvailableModels((current) =>
            current.join("\u0000") === orderedModels.join("\u0000")
              ? current
              : orderedModels
          );
        }
      } catch {
        if (!cancelled) {
          setIsOllamaRunning(false);
          setAvailableModels((current) => (current.length === 0 ? current : []));
        }
      }
    }

    loadModels();
    window.addEventListener("vaultr-models-updated", loadModels);

    // This effect only refreshes Ollama availability. Model selection is reconciled
    // in the guarded effect below so streaming message updates cannot retrigger fetches.
    return () => {
      cancelled = true;
      window.removeEventListener("vaultr-models-updated", loadModels);
    };
  }, []);

  useEffect(() => {
    const nextModel = getNextSelectedModel({
      availableModels,
      cloudMode,
      defaultModelPreference,
      isOllamaRunning,
      selectedModel,
    });

    if (nextModel === selectedModel) return;
    setSelectedModel(nextModel);
    // This effect intentionally depends on primitive model state and exits unless
    // the derived target changes, preventing selectedModel writes from looping.
  }, [
    availableModels,
    cloudMode,
    defaultModelPreference,
    isOllamaRunning,
    selectedModel,
    setSelectedModel,
  ]);

  const selectedLabel = cloudMode
    ? selectedModel
      ? groqIdToLexName(selectedModel)
      : "Lex Core"
    : !isOllamaRunning
    ? "Ollama not running"
    : selectedModel && availableModels.includes(selectedModel)
    ? ollamaIdToLexName(selectedModel)
    : "Install a Lex Model";
  const menuPosition =
    direction === "down"
      ? "top-full mt-2"
      : "bottom-full mb-2";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-sm text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)] disabled:cursor-not-allowed"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close model selector"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute right-0 z-50 min-w-[360px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1.5 text-[var(--text)] shadow-[0_4px_16px_var(--shadow-soft)] ${menuPosition}`}
          >
            {!cloudMode && !isOllamaRunning ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                Ollama not running
              </div>
            ) : !cloudMode && availableModels.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                <div>No Lex models installed</div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/models");
                  }}
                  className="mt-1 text-[13px] text-[var(--text)] transition-colors hover:text-[var(--text-muted)]"
                >
                  → Go to Models page
                </button>
              </div>
            ) : (
              <>
                {!cloudMode && availableModels.map((modelId) => {
                  const metadata = getModelDisplayMetadata(modelId);
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => {
                        setSelectedModel(modelId);
                        setOpen(false);
                      }}
                      className="w-full rounded-[var(--radius-sm)] border-0 bg-transparent text-left transition-[background-color] duration-150 hover:bg-[var(--surface)]"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1916" }}>
                            {metadata.name}
                          </span>
                          <span className="truncate text-[11px] text-[var(--text-muted)]">
                            {metadata.modelId} · {metadata.provider}
                          </span>
                        </span>
                        {modelId === selectedModel && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
                {!cloudMode && availableModels.length > 0 && (
                  <div style={{ borderTop: "1px solid #e0ded8", margin: "4px 0" }} />
                )}
                {cloudMode && GROQ_MODELS.map((model) => {
                  const modelId = model.groqId;
                  const metadata = getModelDisplayMetadata(modelId);
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => {
                        setSelectedModel(modelId);
                        setOpen(false);
                      }}
                      className="w-full rounded-[var(--radius-sm)] border-0 bg-transparent text-left transition-[background-color] duration-150 hover:bg-[var(--surface)]"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1916" }}>
                            {metadata.name}
                          </span>
                          <span className="truncate text-[11px] text-[var(--text-muted)]">
                            {metadata.modelId} · {metadata.provider}
                          </span>
                        </span>
                        {modelId === selectedModel && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
                {!cloudMode && (
                <div style={{ borderTop: "1px solid #e0ded8", marginTop: "4px", paddingTop: "4px" }}>
                  <div
                    onClick={() => {
                      setOpen(false);
                      router.push("/models");
                    }}
                    style={{
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "#378ADD",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>⊕</span>
                    <span>Install more Lex models →</span>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getNextSelectedModel({
  availableModels,
  cloudMode,
  defaultModelPreference,
  isOllamaRunning,
  selectedModel,
}: {
  availableModels: string[];
  cloudMode: boolean;
  defaultModelPreference: string;
  isOllamaRunning: boolean;
  selectedModel: string | null;
}) {
  if (cloudMode) {
    return GROQ_MODELS.some((model) => model.groqId === selectedModel)
      ? selectedModel
      : GROQ_DEFAULT_MODEL;
  }

  if (!isOllamaRunning || availableModels.length === 0) return null;
  if (selectedModel && availableModels.includes(selectedModel)) return selectedModel;
  return availableModels.includes(defaultModelPreference)
    ? defaultModelPreference
    : availableModels[0];
}
