/**
 * Tauri environment helpers for Vaultr.
 * Manages app data directories, API key loading from environment and disk, and configuration.
 * @module tauri-env
 */

import fs from "fs";
import os from "os";
import path from "path";

const APP_DATA_ENV = "VAULTR_APP_DATA_DIR";
const API_KEYS_FILE = "api-keys.json";

/**
 * All configurable API key environment variable names.
 * @constant {(readonly ["GROQ_API_KEY", "TAVILY_API_KEY", "GEMINI_API_KEY", "OLLAMA_API_KEY", "CEREBRAS_API_KEY", "HARVARD_CAP_API_KEY", "CLAUDEOPUS_API_KEY"])}
 */
export const API_KEY_NAMES = [
  "GROQ_API_KEY",
  "TAVILY_API_KEY",
  "GEMINI_API_KEY",
  "OLLAMA_API_KEY",
  "CEREBRAS_API_KEY",
  "HARVARD_CAP_API_KEY",
  "CLAUDEOPUS_API_KEY",
  "VOYAGE_API_KEY",
] as const;

// In-memory cache for API keys - populated once per server instance
let apiKeyCache: ApiKeyValues | null = null;
let cacheLoaded = false;

/**
 * The type of an API key name from API_KEY_NAMES.
 */
export type ApiKeyName = (typeof API_KEY_NAMES)[number];

/**
 * A partial record mapping API key names to their values.
 */
export type ApiKeyValues = Partial<Record<ApiKeyName, string>>;

/**
 * Get the Vaultr app data directory.
 * Respects VAULTR_APP_DATA_DIR environment variable, otherwise uses platform defaults.
 * @returns The absolute path to the Vaultr data directory.
 */
export function getVaultrDataDir() {
  const configuredDir = process.env[APP_DATA_ENV]?.trim();
  if (configuredDir) {
    return isVaultrDataDir(configuredDir) ? configuredDir : path.join(configuredDir, ".vaultr");
  }

  return path.join(getDefaultAppDataDir(), ".vaultr");
}

/**
 * Get the full path to the Vaultr SQLite database file.
 * @returns The absolute path to vaultr.db.
 */
export function getVaultrDbPath() {
  return path.join(getVaultrDataDir(), "vaultr.db");
}

/**
 * Get a configured API key value.
 * Environment variables take precedence; falls back to cached values from disk.
 * @param name - The API key name (e.g., "GROQ_API_KEY").
 * @returns The API key value, or empty string if not configured.
 */
export function getConfiguredApiKey(name: ApiKeyName) {
  // Server-only guard: API keys must never be accessed from the client
  if (typeof window !== "undefined") {
    throw new Error("getConfiguredApiKey must only be called server-side");
  }

  // First check environment variable (always takes precedence)
  const environmentValue = process.env[name]?.trim();
  if (environmentValue) return environmentValue;

  // Use cached keys from disk (loaded once)
  if (!cacheLoaded) {
    apiKeyCache = readSavedApiKeys();
    cacheLoaded = true;
  }
  return apiKeyCache?.[name]?.trim() || "";
}

/**
 * Get all configured API key values as an object.
 * @returns An object mapping each API key name to its value.
 */
export function getConfiguredApiKeys() {
  const keys: ApiKeyValues = {};
  for (const name of API_KEY_NAMES) {
    const value = getConfiguredApiKey(name);
    if (value) keys[name] = value;
  }
  return keys;
}

function readSavedApiKeys(): ApiKeyValues {
  try {
    const raw = fs.readFileSync(getApiKeysPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return API_KEY_NAMES.reduce<ApiKeyValues>((acc, name) => {
      const value = parsed[name];
      if (typeof value === "string" && value.trim()) acc[name] = value.trim();
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function getApiKeysPath() {
  return path.join(getVaultrDataDir(), API_KEYS_FILE);
}

function getDefaultAppDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Vaultr");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), "Vaultr");
  }

  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgDataHome, "Vaultr");
}

function isVaultrDataDir(dir: string) {
  return path.basename(dir) === ".vaultr";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
