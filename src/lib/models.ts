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
  provider: "groq" | "gemini" | "ollama-cloud";
  badge: string;
  color: string;
  description: string;
}

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const GEMINI_ULTRA_MODEL = "gemini-2.5-flash-preview-05-20";
export const GEMINI_MAX_MODEL = "gemini-3-flash-preview";

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "groq-core",
    name: "Lex Core",
    groqId: GROQ_DEFAULT_MODEL,
    provider: "groq",
    badge: "Core",
    color: "#378ADD",
    description: "Best all-round. Default for most legal work.",
  },
  {
    id: "groq-pro",
    name: "Lex Pro",
    groqId: "qwen/qwen3-32b",
    provider: "groq",
    badge: "Pro",
    color: "#7F77DD",
    description: "Deep reasoning. Chain-of-thought for complex analysis.",
  },
  {
    id: "gemini-ultra",
    name: "Lex Ultra",
    groqId: GEMINI_ULTRA_MODEL,
    provider: "gemini",
    badge: "Ultra",
    color: "#9A6BFF",
    description: "Gemini 2.5 Flash — fast reasoning for contract analysis.",
  },
  {
    id: "gemini-max",
    name: "Lex Max",
    groqId: GEMINI_MAX_MODEL,
    provider: "gemini",
    badge: "Max",
    color: "#C9A84C",
    description: "Gemini 3 Flash — most powerful. Deep legal analysis.",
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

export function isOllamaCloudModel(_modelId: string | null | undefined): boolean {
  return false;
}

export function groqIdToLexName(groqId: string): string {
  return GROQ_MODELS.find((model) => model.groqId === groqId)?.name || "Lex Core";
}

export function getCloudProviderLabel(provider: GroqModel["provider"]) {
  if (provider === "gemini") return "Google";
  if (provider === "ollama-cloud") return "Ollama Cloud";
  return "Groq";
}

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
