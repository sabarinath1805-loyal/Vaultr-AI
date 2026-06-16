/**
 * Model configuration for local Lex (Ollama) models.
 * @interface LexModel
 * @property {string} id - Unique identifier for this model tier
 * @property {string} tierId - Short tier identifier (e.g., "flash", "core", "pro")
 * @property {string} tierName - Display name including tier (e.g., "Lex Flash (Private)")
 * @property {string} ollamaId - The Ollama model ID to use when pulling/ringing
 * @property {string} name - Short display name
 * @property {string} badge - Badge text shown in UI (e.g., "Flash")
 * @property {string} color - Hex color for visual identification
 * @property {string} ramRequired - Human-readable RAM requirement
 * @property {string} description - Feature description for users
 * @property {number} speed - Relative speed score (0-100)
 * @property {number} reasoning - Relative reasoning score (0-100)
 * @property {number} legalDepth - Relative legal analysis depth score (0-100)
 */
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

/**
 * Model configuration for cloud-hosted models via Groq.
 * @interface GroqModel
 * @property {string} id - UI identifier (e.g., "anthropic-core")
 * @property {string} name - Display name (e.g., "Lex Core")
 * @property {string} groqId - Groq-assigned model identifier
 * @property {"anthropic" | "cerebras" | "groq" | "gemini" | "ollama-cloud"} provider - The underlying LLM provider
 * @property {string} badge - Badge text shown in UI (e.g., "Core")
 * @property {string} color - Hex color for visual identification
 * @property {string} description - Feature description for users
 */
export interface GroqModel {
  id: string;
  name: string;
  groqId: string;
  provider: "anthropic" | "cerebras" | "groq" | "gemini" | "ollama-cloud";
  badge: string;
  color: string;
  description: string;
}

export const ANTHROPIC_CORE_MODEL = "claude-haiku-4-5-20251001";
export const ANTHROPIC_PRO_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_ULTRA_MODEL = "claude-opus-4-7";
export const ANTHROPIC_MAX_MODEL = "claude-opus-4-8";
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
    description: "Claude Sonnet 4.6 — powerful analysis for complex legal work.",
  },
  {
    id: "anthropic-ultra",
    name: "Lex Ultra",
    groqId: ANTHROPIC_ULTRA_MODEL,
    provider: "anthropic",
    badge: "Ultra",
    color: "#9A6BFF",
    description: "Claude Opus 4.7 — advanced reasoning for contract analysis.",
  },
  {
    id: "anthropic-max",
    name: "Lex Max",
    groqId: ANTHROPIC_MAX_MODEL,
    provider: "anthropic",
    badge: "Max",
    color: "#C9A84C",
    description: "Claude Opus 4.8 — comprehensive deep analysis. Allow 1-2 minutes.",
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

/**
 * Get a list of all Anthropic model IDs available via Groq.
 * @returns An array of Groq model IDs (e.g., "claude-haiku-4-5-20251001").
 */
export function getAnthropicModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "anthropic").map(
    (model) => model.groqId
  );
}

/**
 * Check whether a given model ID is an Anthropic model routed through Groq.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is an Anthropic model via Groq, `false` otherwise.
 */
export function isAnthropicModel(modelId: string | null | undefined): boolean {
  return !!modelId && getAnthropicModelIds().includes(modelId);
}

/**
 * Get a list of all Cerebras model IDs available via Groq.
 * @returns An array of Groq model IDs.
 */
export function getCerebrasModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "cerebras").map(
    (model) => model.groqId
  );
}

/**
 * Check whether a given model ID is a Cerebras model routed through Groq.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is a Cerebras model via Groq, `false` otherwise.
 */
export function isCerebrasModel(modelId: string | null | undefined): boolean {
  return !!modelId && getCerebrasModelIds().includes(modelId);
}

/**
 * Get a list of all native Groq model IDs.
 * @returns An array of Groq model IDs.
 */
export function getGroqModelIds(): string[] {
  return GROQ_MODELS.filter((model) => model.provider === "groq").map(
    (model) => model.groqId
  );
}

/**
 * Check whether a given model ID is a native Groq model.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is a native Groq model, `false` otherwise.
 */
export function isGroqModel(modelId: string | null | undefined): boolean {
  return !!modelId && getGroqModelIds().includes(modelId);
}

/**
 * Get a list of all cloud model IDs (Anthropic, Cerebras, Groq, Gemini, Ollama Cloud).
 * @returns An array of all Groq model IDs.
 */
export function getCloudModelIds(): string[] {
  return GROQ_MODELS.map((model) => model.groqId);
}

/**
 * Check whether a given model ID is any cloud model.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is a cloud model, `false` otherwise.
 */
export function isCloudModel(modelId: string | null | undefined): boolean {
  return !!modelId && getCloudModelIds().includes(modelId);
}

/**
 * Check whether a given model ID is a Google Gemini model.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is a Gemini model, `false` otherwise.
 */
export function isGeminiModel(modelId: string | null | undefined): boolean {
  return !!modelId && GROQ_MODELS.some(
    (model) => model.provider === "gemini" && model.groqId === modelId
  );
}

/**
 * Check whether a given model ID is an Ollama Cloud model.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is an Ollama Cloud model, `false` otherwise.
 */
export function isOllamaCloudModel(modelId: string | null | undefined): boolean {
  return !!modelId && GROQ_MODELS.some(
    (model) => model.provider === "ollama-cloud" && model.groqId === modelId
  );
}

/**
 * Convert a Groq model ID to its Lex display name.
 * @param groqId - The Groq model ID (e.g., "claude-haiku-4-5-20251001").
 * @returns The Lex display name (e.g., "Lex Core"), or "Lex Core" if not found.
 */
export function groqIdToLexName(groqId: string): string {
  return GROQ_MODELS.find((model) => model.groqId === groqId)?.name || "Lex Core";
}

/**
 * Get a human-readable label for a cloud provider.
 * @param provider - The provider type from the GroqModel.
 * @returns A display string (e.g., "Anthropic", "Google", "Cerebras").
 */
export function getCloudProviderLabel(provider: GroqModel["provider"]) {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "cerebras") return "Cerebras";
  if (provider === "gemini") return "Google";
  if (provider === "ollama-cloud") return "Ollama Cloud";
  return "Groq";
}

export const ANTHROPIC_FALLBACK_CHAIN: string[] = [
  ANTHROPIC_MAX_MODEL,
  ANTHROPIC_ULTRA_MODEL,
  ANTHROPIC_PRO_MODEL,
  ANTHROPIC_CORE_MODEL,
];

export const OLLAMA_CLOUD_FALLBACK_MODELS = [
  "minimax-m2.5:cloud",
  "kimi-k2.5:cloud",
  "glm-5:cloud",
];

/**
 * Get display metadata for any model ID (cloud or local Lex).
 * @param modelId - The model ID to look up.
 * @returns An object with `badge`, `color`, `name`, `modelId`, and `provider` fields for UI rendering.
 */
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

/**
 * Convert an Ollama model ID to its Lex display name.
 * @param ollamaId - The Ollama model ID (e.g., "phi4-mini").
 * @returns The Lex display name (e.g., "Lex Core (Private)"), or "Lex Model" if not found.
 */
export function ollamaIdToLexName(ollamaId: string): string {
  const tierModel = LEX_MODELS.find((model) => model.ollamaId === ollamaId);
  if (tierModel) return tierModel.name;

  return "Lex Model";
}

/**
 * Convert a Lex display name to its Ollama model ID.
 * @param lexName - The Lex display name (e.g., "Lex Core (Private)").
 * @returns The Ollama model ID, or `undefined` if not found.
 */
export function lexNameToOllamaId(lexName: string): string | undefined {
  const model = LEX_MODELS.find((m) => m.name === lexName);
  return model?.ollamaId;
}

/**
 * Check whether a given model ID is a local Lex (Ollama) model.
 * @param modelId - The model ID to check.
 * @returns `true` if the model is a local Lex model, `false` otherwise.
 */
export function isLexModel(modelId: string | null | undefined): boolean {
  return !!modelId && getLexModelIds().includes(modelId);
}

/**
 * Get the default Lex model (first in the tier list).
 * @returns The default LexModel configuration.
 */
export function getDefaultModel(): LexModel {
  return LEX_MODELS[0];
}

/**
 * Sort model IDs according to Lex tier priority (Flash → Core → Pro).
 * Filters to only include models that are actually installed.
 * @param modelIds - An array of model IDs to sort.
 * @returns Sorted array of model IDs.
 */
export function sortModelsByLexOrder(modelIds: string[]): string[] {
  const installed = new Set(modelIds);
  const ordered = getLexModelIds().filter((modelId) => installed.has(modelId));
  return Array.from(new Set(ordered));
}

/**
 * Model IDs that support extended thinking/reasoning streams.
 * These emit `<think>` tokens that are displayed in a collapsible UI panel.
 * @constant {string[]}
 */
export const THINKING_CAPABLE_MODEL_IDS = [
  "gemma4:e2b",
  "phi4-mini",
  "qwen3:8b",
];

/**
 * Check whether a model supports extended thinking streams.
 * @param modelId - The model ID to check.
 * @returns `true` if the model emits thinking tokens, `false` otherwise.
 */
export function isThinkingCapableModel(modelId: string | null | undefined): boolean {
  return !!modelId && THINKING_CAPABLE_MODEL_IDS.includes(modelId);
}
