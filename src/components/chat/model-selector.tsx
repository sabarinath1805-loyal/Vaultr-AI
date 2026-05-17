"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Cloud, Lock } from "lucide-react";
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
          setAvailableModels(orderedModels);
          if (cloudMode) {
            if (!GROQ_MODELS.some((model) => model.groqId === selectedModel)) {
              setSelectedModel(GROQ_DEFAULT_MODEL);
            }
          } else if (orderedModels.length === 0 && selectedModel) {
            setSelectedModel(null);
          } else if (orderedModels.length > 0 && !orderedModels.includes(selectedModel || "")) {
            setSelectedModel(
              orderedModels.includes(defaultModelPreference)
                ? defaultModelPreference
                : orderedModels[0]
            );
          }
        }
      } catch {
        if (!cancelled) {
          setIsOllamaRunning(false);
          setAvailableModels([]);
          if (cloudMode) {
            if (!GROQ_MODELS.some((model) => model.groqId === selectedModel)) {
              setSelectedModel(GROQ_DEFAULT_MODEL);
            }
          } else if (selectedModel) {
            setSelectedModel(null);
          }
        }
      }
    }

    loadModels();
    window.addEventListener("vaultr-models-updated", loadModels);

    return () => {
      cancelled = true;
      window.removeEventListener("vaultr-models-updated", loadModels);
    };
  }, [cloudMode, defaultModelPreference, selectedModel, setSelectedModel]);

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
                {availableModels.map((modelId) => {
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
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: `${metadata.color}20`,
                            color: metadata.color,
                            letterSpacing: "0.05em",
                          }}
                        >
                          {metadata.badge}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1916" }}>
                          {metadata.name}
                        </span>
                        <span style={{ fontSize: "11px", color: "#8a8880", marginLeft: "auto" }}>
                          {metadata.modelId}
                        </span>
                        <Lock size={13} color="#8a8880" />
                        {modelId === selectedModel && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
                {availableModels.length > 0 && (
                  <div style={{ borderTop: "1px solid #e0ded8", margin: "4px 0" }} />
                )}
                {GROQ_MODELS.map((model) => {
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
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: `${metadata.color}20`,
                            color: metadata.color,
                            letterSpacing: "0.05em",
                          }}
                        >
                          CLOUD
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1916" }}>
                          {metadata.name}
                        </span>
                        <span style={{ fontSize: "11px", color: "#8a8880", marginLeft: "auto" }}>
                          {metadata.modelId}
                        </span>
                        <Cloud size={13} color="#378ADD" />
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
