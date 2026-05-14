export interface LexModel {
  id: string;
  ollamaId: string;
  name: string;
  tier: string;
  description: string;
  ram: string;
  size: string;
  speed: number;
  reasoning: number;
  legalDepth: number;
}

export const LEX_MODELS: LexModel[] = [
  {
    id: "lex-nano",
    ollamaId: "qwen3:8b",
    name: "Lex Nano",
    tier: "Nano",
    description: "Lightning-fast for quick legal lookups and drafting.",
    ram: "8GB",
    size: "5GB",
    speed: 95,
    reasoning: 60,
    legalDepth: 55,
  },
  {
    id: "lex-core",
    ollamaId: "qwen3:14b",
    name: "Lex Core",
    tier: "Core",
    description: "Balanced speed and reasoning for daily contract work.",
    ram: "16GB",
    size: "9GB",
    speed: 82,
    reasoning: 72,
    legalDepth: 68,
  },
  {
    id: "lex-pro",
    ollamaId: "qwen3:30b",
    name: "Lex Pro",
    tier: "Pro",
    description: "Deep clause analysis for complex agreements.",
    ram: "32GB",
    size: "19GB",
    speed: 65,
    reasoning: 85,
    legalDepth: 82,
  },
  {
    id: "lex-advanced",
    ollamaId: "magistral",
    name: "Lex Advanced",
    tier: "Advanced",
    description: "Built for legal reasoning with traceable logic.",
    ram: "32GB",
    size: "14GB",
    speed: 50,
    reasoning: 90,
    legalDepth: 92,
  },
  {
    id: "lex-elite",
    ollamaId: "deepseek-r1:14b",
    name: "Lex Elite",
    tier: "Elite",
    description: "Chain-of-thought reasoning for litigation work.",
    ram: "16GB",
    size: "9GB",
    speed: 60,
    reasoning: 88,
    legalDepth: 85,
  },
  {
    id: "lex-max",
    ollamaId: "deepseek-r1:32b",
    name: "Lex Max",
    tier: "Max",
    description: "Maximum reasoning depth for the most complex matters.",
    ram: "32GB",
    size: "20GB",
    speed: 35,
    reasoning: 97,
    legalDepth: 96,
  },
];

export function ollamaIdToLexName(ollamaId: string): string {
  const model = LEX_MODELS.find((m) => m.ollamaId === ollamaId);
  return model ? model.name : "Lex Model";
}

export function lexNameToOllamaId(lexName: string): string | undefined {
  const model = LEX_MODELS.find((m) => m.name === lexName);
  return model?.ollamaId;
}

export function isLexModel(modelId: string | null | undefined): boolean {
  return !!modelId && LEX_MODELS.some((model) => model.ollamaId === modelId);
}

export function getDefaultModel(): LexModel {
  return LEX_MODELS[0];
}

export function sortModelsByLexOrder(modelIds: string[]): string[] {
  const installed = new Set(modelIds);
  return LEX_MODELS.map((model) => model.ollamaId).filter((modelId) =>
    installed.has(modelId)
  );
}

export const THINKING_CAPABLE_MODEL_IDS = [
  "qwen3:8b",
  "qwen3:14b",
  "qwen3:30b",
  "deepseek-r1:14b",
  "deepseek-r1:32b",
];

export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
