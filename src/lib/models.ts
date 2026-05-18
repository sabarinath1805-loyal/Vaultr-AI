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
  badge: string;
  color: string;
  description: string;
}

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "groq-flash",
    name: "Lex Flash",
    groqId: "llama-3.1-8b-instant",
    badge: "SWIFT",
    color: "#1D9E75",
    description: "Fastest responses for quick legal queries.",
  },
  {
    id: "groq-core",
    name: "Lex Core",
    groqId: GROQ_DEFAULT_MODEL,
    badge: "BALANCED",
    color: "#378ADD",
    description: "Best all-round quality for daily legal work.",
  },
  {
    id: "groq-pro",
    name: "Lex Pro",
    groqId: "mixtral-8x7b-32768",
    badge: "POWERFUL",
    color: "#7F77DD",
    description: "Long context for complex contracts.",
  },
];

export const LEX_MODELS: LexModel[] = [
  {
    id: "lex-flash",
    tierId: "flash",
    tierName: "Lex Flash",
    name: "Lex Flash",
    ollamaId: "qwen3:4b",
    badge: "SWIFT",
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
    tierName: "Lex Core",
    name: "Lex Core",
    ollamaId: "qwen3:8b",
    badge: "BALANCED",
    color: "#378ADD",
    ramRequired: "16GB RAM · 5GB",
    description: "Best all-round local model for 16GB Macs.",
    speed: 85,
    reasoning: 72,
    legalDepth: 68,
  },
  {
    id: "lex-pro",
    tierId: "pro",
    tierName: "Lex Pro",
    name: "Lex Pro",
    ollamaId: "deepseek-r1:7b",
    badge: "POWERFUL",
    color: "#7F77DD",
    ramRequired: "16GB RAM · 5GB",
    description: "Chain-of-thought reasoning for complex contracts.",
    speed: 70,
    reasoning: 80,
    legalDepth: 78,
  },
];

function getLexModelIds(): string[] {
  return LEX_MODELS.map((model) => model.ollamaId);
}

export function getGroqModelIds(): string[] {
  return GROQ_MODELS.map((model) => model.groqId);
}

export function isGroqModel(modelId: string | null | undefined): boolean {
  return !!modelId && getGroqModelIds().includes(modelId);
}

export function groqIdToLexName(groqId: string): string {
  return GROQ_MODELS.find((model) => model.groqId === groqId)?.name || "Lex Core";
}

export function getModelDisplayMetadata(modelId: string) {
  const groqModel = GROQ_MODELS.find((model) => model.groqId === modelId);
  if (groqModel) {
    return {
      badge: groqModel.badge,
      color: groqModel.color,
      name: groqModel.name,
      modelId: groqModel.groqId,
    };
  }

  const tierModel = LEX_MODELS.find((model) => model.ollamaId === modelId);
  if (tierModel) {
    return {
      badge: tierModel.badge,
      color: tierModel.color,
      name: tierModel.name,
      modelId: tierModel.ollamaId,
    };
  }

  return {
    badge: "LEX",
    color: "#378ADD",
    name: "Lex Model",
    modelId,
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
  "qwen3:4b",
  "qwen3:8b",
  "deepseek-r1:7b",
];

export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
