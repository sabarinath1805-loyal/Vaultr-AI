export interface LexModel {
  id: string;
  tierId: string;
  tierName: string;
  ollamaId: string;
  name: string;
  badge: string;
  color: string;
  ramRequired: string;
  description: string;
  speed: number;
  reasoning: number;
  legalDepth: number;
}

export interface GroqModel {
  id: string;
  name: string;
  groqId: string;
  provider: "anthropic" | "cerebras" | "groq" | "gemini" | "ollama-cloud";
  badge: string;
  color: string;
  description: string;
}

export const ANTHROPIC_CORE_MODEL = "claude-3-haiku";
export const ANTHROPIC_PRO_MODEL = "claude-sonnet-4-5";
export const ANTHROPIC_ULTRA_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_MAX_MODEL = "claude-opus-4-6";
export const CEREBRAS_CORE_MODEL = "llama4-scout";
export const CEREBRAS_PRO_MODEL = "gpt-oss-120b-low";
export const CEREBRAS_ULTRA_MODEL = "glm-4.7";
export const CEREBRAS_MAX_MODEL = "qwen3-235b";
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const GEMINI_ULTRA_MODEL = "gemini-2.5-flash";
export const GEMINI_MAX_MODEL = "gemini-3.0-flash";

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "anthropic-core",
    name: "Lex Core",
    groqId: ANTHROPIC_CORE_MODEL,
    provider: "anthropic",
    badge: "Core",
    color: "#378ADD",
    description: "Claude Haiku — fast all-round. Default for most legal work.",
  },
  {
    id: "anthropic-pro",
    name: "Lex Pro",
    groqId: ANTHROPIC_PRO_MODEL,
    provider: "anthropic",
    badge: "Pro",
    color: "#7F77DD",
    description: "Claude Sonnet 4.5 — powerful analysis for complex legal work.",
  },
  {
    id: "anthropic-ultra",
    name: "Lex Ultra",
    groqId: ANTHROPIC_ULTRA_MODEL,
    provider: "anthropic",
    badge: "Ultra",
    color: "#9A6BFF",
    description: "Claude Sonnet 4.6 — advanced reasoning for contract analysis.",
  },
  {
    id: "anthropic-max",
    name: "Lex Max",
    groqId: ANTHROPIC_MAX_MODEL,
    provider: "anthropic",
    badge: "Max",
    color: "#C9A84C",
    description: "Claude Opus 4.6 — comprehensive deep analysis. Allow 1-2 minutes.",
  },
];

export const LEX_MODELS: LexModel[] = [
  {
    id: "lex-flash",
    tierId: "flash",
    tierName: "Lex Flash (Private)",
    name: "Lex Flash (Private)",
    ollamaId: "gemma4:e2b",
    badge: "Flash",
    color: "#1D9E75",
    ramRequired: "16GB RAM · 2.6GB",
    description: "Fastest local model. Strong reasoning for its size.",
    speed: 97,
    reasoning: 68,
    legalDepth: 62,
  },
  {
    id: "lex-core",
    tierId: "core",
    tierName: "Lex Core (Private)",
    name: "Lex Core (Private)",
    ollamaId: "phi4-mini",
    badge: "Core",
    color: "#378ADD",
    ramRequired: "16GB RAM · 3.8GB",
    description: "Best reasoning per GB. Ideal for most legal queries.",
    speed: 85,
    reasoning: 72,
    legalDepth: 68,
  },
  {
    id: "lex-pro",
    tierId: "pro",
    tierName: "Lex Pro (Private)",
    name: "Lex Pro (Private)",
    ollamaId: "qwen3:8b",
    badge: "Pro",
    color: "#7F77DD",
    ramRequired: "16GB RAM · 5.2GB",
    description: "Most capable local model. Best for deep legal analysis.",
    speed: 72,
    reasoning: 86,
    legalDepth: 84,
  },
];

function getLexModelIds(): string[] {
  return LEX_MODELS.map((model) => model.ollamaId);
}

export function getAnthropicModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "anthropic").map(
    (model) => model.groqId
  );
}

export function isAnthropicModel(modelId: string | null | undefined): boolean {
  return !!modelId && getAnthropicModelIds().includes(modelId);
}

export function getCerebrasModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "cerebras").map(
    (model) => model.groqId
  );
}

export function isCerebrasModel(modelId: string | null | undefined): boolean {
  return !!modelId && getCerebrasModelIds().includes(modelId);
}

export function getGroqModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "groq").map(
    (model) => model.groqId
  );
}

export function isGroqModel(modelId: string | null | undefined): boolean {
  return !!modelId && getGroqModelIds().includes(modelId);
}

export function getCloudModelIds(): string[] {
  return GROQ_MODELS.map((model) => model.groqId);
}

export function isCloudModel(modelId: string | null | undefined): boolean {
  return !!modelId && getCloudModelIds().includes(modelId);
}

export function isGeminiModel(modelId: string | null | undefined): boolean {
  return !!modelId && GROQ_MODELS.some(
    (model) => model.provider === "gemini" && model.groqId === modelId
  );
}

export function isOllamaCloudModel(modelId: string | null | undefined): boolean {
  return !!modelId && GROQ_MODELS.some(
    (model) => model.provider === "ollama-cloud" && model.groqId === modelId
  );
}

export function groqIdToLexName(groqId: string): string {
  return GROQ_MODELS.find((model) => model.groqId === groqId)?.name || "Lex Core";
}

export function getCloudProviderLabel(provider: GroqModel["provider"]) {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "cerebras") return "Cerebras";
  if (provider === "gemini") return "Google";
  if (provider === "ollama-cloud") return "Ollama Cloud";
  return "Groq";
}

export const OLLAMA_CLOUD_FALLBACK_MODELS = [
  "minimax-m2.5:cloud",
  "kimi-k2.5:cloud",
  "glm-5:cloud",
];

export function getModelDisplayMetadata(modelId: string) {
  const groqModel = GROQ_MODELS.find((model) => model.groqId === modelId);
  if (groqModel) {
    return {
      badge: groqModel.badge,
      color: groqModel.color,
      name: groqModel.name,
      modelId: groqModel.groqId,
      provider: getCloudProviderLabel(groqModel.provider),
    };
  }

  const tierModel = LEX_MODELS.find((model) => model.ollamaId === modelId);
  if (tierModel) {
    return {
      badge: tierModel.badge,
      color: tierModel.color,
      name: tierModel.name,
      modelId: tierModel.ollamaId,
      provider: "Ollama",
    };
  }

  return {
    badge: "LEX",
    color: "#378ADD",
    name: "Lex Model",
    modelId,
    provider: "Model",
  };
}

export function ollamaIdToLexName(ollamaId: string): string {
  const tierModel = LEX_MODELS.find((model) => model.ollamaId === ollamaId);
  if (tierModel) return tierModel.name;

  return "Lex Model";
}

export function lexNameToOllamaId(lexName: string): string | undefined {
  const model = LEX_MODELS.find((m) => m.name === lexName);
  return model?.ollamaId;
}

export function isLexModel(modelId: string | null | undefined): boolean {
  return !!modelId && getLexModelIds().includes(modelId);
}

export function getDefaultModel(): LexModel {
  return LEX_MODELS[0];
}

export function sortModelsByLexOrder(modelIds: string[]): string[] {
  const installed = new Set(modelIds);
  const ordered = getLexModelIds().filter((modelId) => installed.has(modelId));
  return Array.from(new Set(ordered));
}

export const THINKING_CAPABLE_MODEL_IDS = [
  "gemma4:e2b",
  "phi4-mini",
  "qwen3:8b",
];

export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
