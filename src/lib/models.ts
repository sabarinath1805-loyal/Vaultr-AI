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
    ollamaId: "gemma4:e2b",
    name: "Lex Nano",
    tier: "Nano",
    description: "Lightning-fast for quick legal lookups.",
    ram: "8GB",
    size: "2GB",
    speed: 95,
    reasoning: 55,
    legalDepth: 50,
  },
  {
    id: "lex-core",
    ollamaId: "gemma4:e4b",
    name: "Lex Core",
    tier: "Core",
    description: "Balanced speed and reasoning for daily work.",
    ram: "8GB",
    size: "4GB",
    speed: 85,
    reasoning: 70,
    legalDepth: 65,
  },
  {
    id: "lex-pro",
    ollamaId: "gemma4:12b",
    name: "Lex Pro",
    tier: "Pro",
    description: "Deep clause analysis for complex agreements.",
    ram: "16GB",
    size: "8GB",
    speed: 70,
    reasoning: 82,
    legalDepth: 78,
  },
  {
    id: "lex-advanced",
    ollamaId: "gemma4:26b",
    name: "Lex Advanced",
    tier: "Advanced",
    description: "Precision reasoning for M&A review.",
    ram: "32GB",
    size: "17GB",
    speed: 55,
    reasoning: 90,
    legalDepth: 88,
  },
  {
    id: "lex-elite",
    ollamaId: "gemma4:31b",
    name: "Lex Elite",
    tier: "Elite",
    description: "Near-human depth for litigation work.",
    ram: "32GB",
    size: "20GB",
    speed: 45,
    reasoning: 94,
    legalDepth: 92,
  },
  {
    id: "lex-max",
    ollamaId: "deepseek-r1:70b",
    name: "Lex Max",
    tier: "Max",
    description: "Maximum intelligence for complex matters.",
    ram: "64GB",
    size: "40GB",
    speed: 30,
    reasoning: 98,
    legalDepth: 97,
  },
];

export function ollamaIdToLexName(ollamaId: string): string {
  const model = LEX_MODELS.find((m) => m.ollamaId === ollamaId);
  return model ? model.name : ollamaId;
}

export function lexNameToOllamaId(lexName: string): string | undefined {
  const model = LEX_MODELS.find((m) => m.name === lexName);
  return model?.ollamaId;
}

export function getDefaultModel(): LexModel {
  return LEX_MODELS[0];
}

export function sortModelsByLexOrder(modelIds: string[]): string[] {
  const installed = new Set(modelIds);
  const knownModels = LEX_MODELS.map((model) => model.ollamaId).filter((modelId) =>
    installed.has(modelId)
  );
  const unknownModels = modelIds.filter(
    (modelId) => !LEX_MODELS.some((model) => model.ollamaId === modelId)
  );

  return [...knownModels, ...unknownModels];
}
