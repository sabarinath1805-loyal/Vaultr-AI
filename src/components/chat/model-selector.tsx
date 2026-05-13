"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { LEX_MODELS, getDefaultModel, ollamaIdToLexName } from "@/lib/models";
import useChatStore from "@/app/hooks/useChatStore";

interface ModelSelectorProps {
  disabled?: boolean;
}

export function ModelSelector({ disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(true);
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
        const installedLexModels = LEX_MODELS.filter((model) =>
          modelIds.includes(model.ollamaId)
        ).map((model) => model.ollamaId);

        if (!cancelled) {
          setIsOllamaRunning(modelIds.length > 0);
          setAvailableModels(installedLexModels);
          if (!selectedModel) {
            setSelectedModel(installedLexModels[0] ?? getDefaultModel().ollamaId);
          }
        }
      } catch {
        if (!cancelled) {
          setIsOllamaRunning(false);
          setAvailableModels([]);
          if (!selectedModel) {
            setSelectedModel(getDefaultModel().ollamaId);
          }
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [selectedModel, setSelectedModel]);

  const selectedLabel = selectedModel
    ? ollamaIdToLexName(selectedModel)
    : getDefaultModel().name;
  const options = availableModels.length
    ? availableModels
    : LEX_MODELS.map((model) => model.ollamaId);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-1 py-1 text-[13px] text-[var(--text-muted)] transition-[color,background-color] duration-150 hover:text-[var(--text)] disabled:cursor-not-allowed"
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
          <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1.5 text-[var(--text)] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
            {!isOllamaRunning ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                Ollama not running
              </div>
            ) : (
              options.map((modelId) => (
                <button
                  key={modelId}
                  type="button"
                  onClick={() => {
                    setSelectedModel(modelId);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--text)] transition-[color,background-color] duration-150 hover:bg-[var(--surface)]"
                >
                  <span>{ollamaIdToLexName(modelId)}</span>
                  {modelId === selectedModel && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
