"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  LEX_MODELS,
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
        const orderedModels = sortModelsByLexOrder(modelIds);

        if (!cancelled) {
          setIsOllamaRunning(modelIds.length > 0);
          setAvailableModels(orderedModels);
          if (orderedModels.length > 0 && !orderedModels.includes(selectedModel || "")) {
            setSelectedModel(orderedModels[0]);
          }
        }
      } catch {
        if (!cancelled) {
          setIsOllamaRunning(false);
          setAvailableModels([]);
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [selectedModel, setSelectedModel]);

  const selectedLabel = !isOllamaRunning
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
            className={`absolute right-0 z-50 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1.5 text-[var(--text)] shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${menuPosition}`}
          >
            {!isOllamaRunning ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                Ollama not running
              </div>
            ) : availableModels.length === 0 ? (
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
              availableModels.map((modelId) => (
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
