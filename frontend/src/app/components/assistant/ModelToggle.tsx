"use client";

import {
    forwardRef,
    useImperativeHandle,
    useState,
} from "react";
import {
    AlertCircle,
    LockKeyhole,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
    LiquidDropdownContent,
    LiquidDropdownItem,
} from "@/app/components/ui/liquid-dropdown";
import { isModelAvailable } from "@/app/lib/modelAvailability";
import type { ApiKeyState } from "@/app/lib/mikeApi";
import { useOllamaModels } from "@/app/hooks/useOllamaModels";
import { MovingIcon } from "@/app/components/ui/moving-icon";

export interface ModelOption {
    id: string;
    label: string;
    group: "Anthropic" | "Google" | "OpenAI" | "Local";
}

export const MODELS: ModelOption[] = [
    { id: "claude-fable-5", label: "Claude Fable 5", group: "Anthropic" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", group: "Anthropic" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", group: "Anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", group: "Google" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", group: "Google" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", group: "Google" },
    { id: "gpt-5.5", label: "GPT-5.5", group: "OpenAI" },
    { id: "gpt-5.4", label: "GPT-5.4", group: "OpenAI" },
    // Local (Ollama) models are appended dynamically — see useOllamaModels.
];

export const SETTINGS_MODELS: ModelOption[] = [
    ...MODELS,
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", group: "Anthropic" },
    {
        id: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite",
        group: "Google",
    },
    { id: "gpt-5.4-lite", label: "GPT-5.4 Lite", group: "OpenAI" },
];

export const DEFAULT_MODEL_ID = "gemini-3-flash-preview";

export const ALLOWED_MODEL_IDS = new Set(MODELS.map((m) => m.id));

const GROUP_ORDER: ModelOption["group"][] = [
    "Anthropic",
    "Google",
    "OpenAI",
];
const MODEL_CONTEXT_HINT: Record<ModelOption["group"], string> = {
    Anthropic: "Long context · reasoning focused",
    Google: "Long context · fast responses",
    OpenAI: "Large context · general purpose",
    Local: "Context depends on your local model",
};
const itemClassName =
    "rounded-xl px-2.5 py-1.5 text-gray-700 focus:bg-app-surface-hover focus:text-gray-900 data-[highlighted]:bg-app-surface-hover data-[highlighted]:text-gray-900";

interface Props {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ApiKeyState;
}

export interface ModelToggleHandle {
    open: () => void;
}

export const ModelToggle = forwardRef<ModelToggleHandle, Props>(
    function ModelToggle({ value, onChange, apiKeys }: Props, ref) {
        const [isOpen, setIsOpen] = useState(false);
        const ollamaModels = useOllamaModels();
        const models = [...MODELS, ...ollamaModels];
        const selected = models.find((m) => m.id === value);
        const selectedLabel = value.startsWith("ollama/")
            ? "🔒 Private"
            : selected?.label ?? "Select model";
        const selectedAvailable = apiKeys
            ? isModelAvailable(value, apiKeys)
            : true;

        useImperativeHandle(
            ref,
            () => ({
                open: () => setIsOpen(true),
            }),
            [],
        );

        return (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={`vaultr-model-toggle flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-sm ${isOpen ? "vaultr-model-toggle-open" : ""}`}
                        title={
                            !selectedAvailable
                                ? "API key missing for selected model"
                                : `${selectedLabel} · ${selected?.group ?? "Model"} · ${selected ? MODEL_CONTEXT_HINT[selected.group] : "Choose a model"}`
                        }
                        aria-label={`Selected model: ${selectedLabel}. ${selected ? MODEL_CONTEXT_HINT[selected.group] : "Choose a model"}`}
                    >
                        <span className="max-w-[140px] truncate">
                            {selectedLabel}
                        </span>
                        <MovingIcon
                            name="chevron-down"
                            className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                </DropdownMenuTrigger>
                <LiquidDropdownContent
                    className="vaultr-model-dropdown z-50 w-[286px] p-2 text-gray-700"
                    side="bottom"
                    align="end"
                >
                    <DropdownMenuLabel className="vaultr-model-section-label">
                        Private
                    </DropdownMenuLabel>
                    {ollamaModels.length > 0 ? (
                        ollamaModels.map((m) => (
                            <LiquidDropdownItem
                                key={m.id}
                                className={`${itemClassName} ${m.id === value ? "bg-app-surface-hover text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" : ""}`}
                                onSelect={() => onChange(m.id)}
                            >
                                <LockKeyhole className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.5} />
                                <span className="flex-1">{m.label}</span>
                                {m.id === value && (
                                    <MovingIcon
                                        name="check"
                                        size={14}
                                        className="ml-1 text-gray-600"
                                    />
                                )}
                            </LiquidDropdownItem>
                        ))
                    ) : (
                        <div className="vaultr-private-empty">
                            <LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.5} />
                            <span>Ollama models appear when available</span>
                        </div>
                    )}
                    <DropdownMenuSeparator className="vaultr-model-separator" />
                    {GROUP_ORDER.map((group, gi) => {
                        const items = models.filter((m) => m.group === group);
                        if (items.length === 0) return null;
                        return (
                            <div key={group}>
                                {gi > 0 && <DropdownMenuSeparator className="vaultr-model-separator" />}
                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
                                    {group}
                                </DropdownMenuLabel>
                                {items.map((m) => {
                                    const available = apiKeys
                                        ? isModelAvailable(m.id, apiKeys)
                                        : true;
                                    return (
                                        <LiquidDropdownItem
                                            key={m.id}
                                            className={`${itemClassName} ${m.id === value ? "bg-app-surface-hover text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" : ""}`}
                                            onSelect={() => onChange(m.id)}
                                        >
                                            <span
                                                className={`flex-1 ${available ? "" : "text-gray-400"}`}
                                            >
                                                {m.label}
                                            </span>
                                            {!available && (
                                                <AlertCircle
                                                    className="ml-1 h-3.5 w-3.5 text-[var(--vaultr-error)]"
                                                    aria-label="API key missing"
                                                />
                                            )}
                                            {m.id === value && available && (
                                                <MovingIcon
                                                    name="check"
                                                    size={14}
                                                    className="ml-1 text-gray-600"
                                                />
                                            )}
                                        </LiquidDropdownItem>
                                    );
                                })}
                            </div>
                        );
                    })}
                </LiquidDropdownContent>
            </DropdownMenu>
        );
    },
);
