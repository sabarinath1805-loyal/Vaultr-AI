import fs from "fs";
import os from "os";
import path from "path";

const APP_DATA_ENV = "VAULTR_APP_DATA_DIR";
const API_KEYS_FILE = "api-keys.json";
const TAURI_BUNDLE_DIR = "com.vaultr.app";

export const API_KEY_NAMES = [
  "GROQ_API_KEY",
  "SERPER_API_KEY",
  "GEMINI_API_KEY",
  "OLLAMA_API_KEY",
] as const;

export type ApiKeyName = (typeof API_KEY_NAMES)[number];
export type ApiKeyValues = Partial<Record<ApiKeyName, string>>;

export function getVaultrDataDir() {
  const configuredDir = process.env[APP_DATA_ENV]?.trim();
  if (configuredDir) {
    return isVaultrDataDir(configuredDir) ? configuredDir : path.join(configuredDir, ".vaultr");
  }

  const baseDir = getDefaultAppDataDir();
  return path.join(baseDir, ".vaultr");
}

export function getVaultrDbPath() {
  return path.join(getVaultrDataDir(), "vaultr.db");
}

export function getConfiguredApiKey(name: ApiKeyName) {
  const environmentValue = process.env[name]?.trim();
  if (environmentValue) return environmentValue;

  const savedKeys = readSavedApiKeys();
  return savedKeys[name]?.trim() || "";
}

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
  return process.env.VAULTR_DESKTOP === "1"
    ? path.join(xdgDataHome, TAURI_BUNDLE_DIR)
    : path.join(xdgDataHome, "Vaultr");
}

function isVaultrDataDir(dir: string) {
  return path.basename(dir) === ".vaultr";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
