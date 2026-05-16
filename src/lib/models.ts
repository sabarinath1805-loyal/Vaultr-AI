export interface LexModelAlternative {
  ollamaId: string;
  label: string;
  ramSize: string;
  description: string;
}

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
  alternatives?: LexModelAlternative[];
}

export const LEX_MODELS: LexModel[] = [
  {
    id: "lex-flash",
    tierId: "flash",
    tierName: "Lex Flash",
    name: "Lex Flash",
    ollamaId: "llama3.2:3b",
    badge: "SWIFT",
    color: "#1D9E75",
    ramRequired: "4GB RAM · 2GB",
    description: "Lightning-fast for quick legal lookups and drafting.",
    speed: 97,
    reasoning: 45,
    legalDepth: 40,
    alternatives: [
      { ollamaId: "gemma3:4b", label: "gemma3:4b", ramSize: "3GB", description: "Strong reasoning at small size · Google" },
      { ollamaId: "phi4-mini:3.8b", label: "phi4-mini:3.8b", ramSize: "2.5GB", description: "Best reasoning per GB · Microsoft" },
    ],
  },
  {
    id: "lex-nano",
    tierId: "nano",
    tierName: "Lex Nano",
    name: "Lex Nano",
    ollamaId: "llama3.2:3b",
    badge: "SWIFT",
    color: "#1D9E75",
    ramRequired: "8GB RAM · 3GB",
    description: "Lightning-fast for quick legal lookups and drafting.",
    speed: 97,
    reasoning: 55,
    legalDepth: 50,
    alternatives: [
      { ollamaId: "gemma3:4b", label: "gemma3:4b", ramSize: "3GB", description: "Strong reasoning · Google" },
      { ollamaId: "phi4-mini:3.8b", label: "phi4-mini:3.8b", ramSize: "2.5GB", description: "Best reasoning per GB · Microsoft" },
    ],
  },
  {
    id: "lex-core",
    tierId: "core",
    tierName: "Lex Core",
    name: "Lex Core",
    ollamaId: "qwen3:8b",
    badge: "BALANCED",
    color: "#378ADD",
    ramRequired: "8GB RAM · 5GB",
    description: "Balanced speed and reasoning for daily contract work.",
    speed: 85,
    reasoning: 72,
    legalDepth: 68,
    alternatives: [
      { ollamaId: "llama3.3:8b", label: "llama3.3:8b", ramSize: "6GB", description: "Best all-round balance · Meta" },
      { ollamaId: "mistral:7b", label: "mistral:7b", ramSize: "4.5GB", description: "Fastest in tier · Structured output" },
    ],
  },
  {
    id: "lex-pro",
    tierId: "pro",
    tierName: "Lex Pro",
    name: "Lex Pro",
    ollamaId: "qwen3:14b",
    badge: "POWERFUL",
    color: "#7F77DD",
    ramRequired: "16GB RAM · 8GB",
    description: "Deep clause analysis with thinking mode.",
    speed: 70,
    reasoning: 80,
    legalDepth: 78,
    alternatives: [
      { ollamaId: "mistral-nemo:12b", label: "mistral-nemo:12b", ramSize: "7GB", description: "Long context 32K · Mistral" },
      { ollamaId: "llama3.3:8b", label: "llama3.3:8b", ramSize: "6GB", description: "Best community support · Meta" },
    ],
  },
  {
    id: "lex-advanced",
    tierId: "advanced",
    tierName: "Lex Advanced",
    name: "Lex Advanced",
    ollamaId: "qwen3:14b",
    badge: "SHARP",
    color: "#534AB7",
    ramRequired: "16GB RAM · 9GB",
    description: "Best all-round model for complex legal reasoning.",
    speed: 65,
    reasoning: 85,
    legalDepth: 83,
    alternatives: [
      { ollamaId: "deepseek-r1:14b", label: "deepseek-r1:14b", ramSize: "9GB", description: "Best reasoning · Chain-of-thought" },
      { ollamaId: "qwen3:30b", label: "qwen3:30b", ramSize: "18GB", description: "Best overall 2026 · Alibaba" },
    ],
  },
  {
    id: "lex-elite",
    tierId: "elite",
    tierName: "Lex Elite",
    name: "Lex Elite",
    ollamaId: "deepseek-r1:32b",
    badge: "DEEP",
    color: "#BA7517",
    ramRequired: "16GB RAM · 9GB",
    description: "Chain-of-thought specialist for litigation work.",
    speed: 45,
    reasoning: 90,
    legalDepth: 88,
    alternatives: [
      { ollamaId: "qwen3:32b", label: "qwen3:32b", ramSize: "18GB", description: "Deep legal analysis · Alibaba" },
    ],
  },
  {
    id: "lex-max",
    tierId: "max",
    tierName: "Lex Max",
    name: "Lex Max",
    ollamaId: "llama4:scout",
    badge: "ELITE",
    color: "#A32D2D",
    ramRequired: "32GB RAM · 20GB",
    description: "Maximum reasoning depth for the most complex matters.",
    speed: 30,
    reasoning: 95,
    legalDepth: 95,
    alternatives: [
      { ollamaId: "deepseek-r1:70b", label: "deepseek-r1:70b", ramSize: "40GB", description: "Best local reasoning · DeepSeek" },
    ],
  },
];

function getLexModelIds(): string[] {
  return LEX_MODELS.flatMap((model) => [
    model.ollamaId,
    ...(model.alternatives || []).map((alternative) => alternative.ollamaId),
  ]);
}

export function ollamaIdToLexName(ollamaId: string): string {
  const tierModel = LEX_MODELS.find((model) => model.ollamaId === ollamaId);
  if (tierModel) return tierModel.name;

  const alternativeTier = LEX_MODELS.find((model) =>
    model.alternatives?.some((alternative) => alternative.ollamaId === ollamaId)
  );
  const alternative = alternativeTier?.alternatives?.find(
    (variant) => variant.ollamaId === ollamaId
  );

  return alternative ? `${alternativeTier?.name}: ${alternative.label}` : "Lex Model";
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
  "llama3.2:3b",
  "gemma3:4b",
  "phi4-mini:3.8b",
  "qwen3:8b",
  "llama3.3:8b",
  "mistral:7b",
  "qwen3:14b",
  "mistral-nemo:12b",
  "deepseek-r1:14b",
  "qwen3:30b",
  "deepseek-r1:32b",
  "qwen3:32b",
  "llama4:scout",
  "deepseek-r1:70b",
];

export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
