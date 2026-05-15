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
    ollamaId: "gemma4:e4b",
    name: "Lex Nano",
    tier: "Nano",
    description: "Lightning-fast for quick legal lookups and drafting.",
    ram: "8GB",
    size: "3GB",
    speed: 97,
    reasoning: 55,
    legalDepth: 50,
  },
  {
    id: "lex-core",
    ollamaId: "qwen3:8b",
    name: "Lex Core",
    tier: "Core",
    description: "Balanced speed and reasoning for daily contract work.",
    ram: "8GB",
    size: "5GB",
    speed: 85,
    reasoning: 72,
    legalDepth: 68,
  },
  {
    id: "lex-pro",
    ollamaId: "gemma4:12b",
    name: "Lex Pro",
    tier: "Pro",
    description: "Deep clause analysis with thinking mode.",
    ram: "16GB",
    size: "8GB",
    speed: 70,
    reasoning: 80,
    legalDepth: 78,
  },
  {
    id: "lex-advanced",
    ollamaId: "qwen3:14b",
    name: "Lex Advanced",
    tier: "Advanced",
    description: "Best all-round model for complex legal reasoning.",
    ram: "16GB",
    size: "9GB",
    speed: 65,
    reasoning: 85,
    legalDepth: 83,
  },
  {
    id: "lex-elite",
    ollamaId: "deepseek-r1:14b",
    name: "Lex Elite",
    tier: "Elite",
    description: "Chain-of-thought specialist for litigation work.",
    ram: "16GB",
    size: "9GB",
    speed: 55,
    reasoning: 92,
    legalDepth: 88,
  },
  {
    id: "lex-max",
    ollamaId: "deepseek-r1:32b",
    name: "Lex Max",
    tier: "Max",
    description: "Maximum reasoning depth for the most complex matters.",
    ram: "32GB",
    size: "20GB",
    speed: 30,
    reasoning: 98,
    legalDepth: 97,
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
  "gemma4:e4b",
  "qwen3:8b",
  "gemma4:12b",
  "qwen3:14b",
  "deepseek-r1:14b",
  "deepseek-r1:32b",
];

export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
