/**
 * Per-model IP-based rate limiting.
 * Tracks daily request limits per IP address per model tier.
 */

import { ANTHROPIC_CORE_MODEL, ANTHROPIC_PRO_MODEL, ANTHROPIC_ULTRA_MODEL, ANTHROPIC_MAX_MODEL } from "./models";

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp when the day resets
}

// In-memory store (resets on server restart — fine for Phase 10, Supabase later)
const rateLimitStore = new Map<string, RateLimitEntry>();

const MODEL_LIMITS: Record<string, number> = {
  [ANTHROPIC_CORE_MODEL]: Infinity, // unlimited
  [ANTHROPIC_PRO_MODEL]: 50,
  [ANTHROPIC_ULTRA_MODEL]: 30,
  [ANTHROPIC_MAX_MODEL]: 10,
};

const MODEL_TIER_ORDER = [
  ANTHROPIC_MAX_MODEL,
  ANTHROPIC_ULTRA_MODEL,
  ANTHROPIC_PRO_MODEL,
  ANTHROPIC_CORE_MODEL,
];

function getKey(ip: string, model: string): string {
  return `${ip}:${model}`;
}

function getDayReset(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime();
}

export function checkRateLimit(ip: string, model: string): { allowed: boolean; downgradeModel?: string; message?: string } {
  const limit = MODEL_LIMITS[model];
  if (limit === undefined || limit === Infinity) {
    return { allowed: true };
  }

  const key = getKey(ip, model);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= limit) {
      // Find next available tier
      const modelIndex = MODEL_TIER_ORDER.indexOf(model);
      for (let i = modelIndex + 1; i < MODEL_TIER_ORDER.length; i++) {
        const fallbackModel = MODEL_TIER_ORDER[i];
        const fallbackLimit = MODEL_LIMITS[fallbackModel];
        if (fallbackLimit === Infinity) {
          return {
            allowed: false,
            downgradeModel: fallbackModel,
            message: `You've reached your ${modelToName(model)} limit for today. ${modelToName(fallbackModel)} is available.`,
          };
        }
        const fallbackKey = getKey(ip, fallbackModel);
        const fallbackEntry = rateLimitStore.get(fallbackKey);
        if (!fallbackEntry || now >= fallbackEntry.resetAt || fallbackEntry.count < fallbackLimit) {
          return {
            allowed: false,
            downgradeModel: fallbackModel,
            message: `You've reached your ${modelToName(model)} limit for today. ${modelToName(fallbackModel)} is available.`,
          };
        }
      }
      return {
        allowed: false,
        message: `You've reached your daily limit for all model tiers. Please try again tomorrow.`,
      };
    }
  }

  return { allowed: true };
}

export function recordUsage(ip: string, model: string): void {
  const limit = MODEL_LIMITS[model];
  if (limit === undefined || limit === Infinity) return;

  const key = getKey(ip, model);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: getDayReset() });
  } else {
    entry.count++;
  }
}

function modelToName(model: string): string {
  switch (model) {
    case ANTHROPIC_MAX_MODEL: return "Lex Max";
    case ANTHROPIC_ULTRA_MODEL: return "Lex Ultra";
    case ANTHROPIC_PRO_MODEL: return "Lex Pro";
    case ANTHROPIC_CORE_MODEL: return "Lex Core";
    default: return model;
  }
}
