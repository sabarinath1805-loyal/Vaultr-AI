import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import * as schema from "./schema";
import { getVaultrDataDir, getVaultrDbPath } from "@/lib/tauri-env";

const dataDir = getVaultrDataDir();
const dbPath = getVaultrDbPath();

fs.mkdirSync(dataDir, { recursive: true });

let sqlite: Database.Database | null = null;
let db: BetterSQLite3Database<typeof schema> | null = null;
let dbInitError: Error | null = null;

try {
  sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      owner_id TEXT NOT NULL DEFAULT 'anonymous'
    );
  `);

  // Backward compatibility: add owner_id column if it doesn't exist
  try {
    const columns = sqlite.prepare("PRAGMA table_info(chats)").all() as Array<{ name: string }>;
    const hasOwnerId = columns.some((col) => col.name === "owner_id");
    if (!hasOwnerId) {
      sqlite.exec(`ALTER TABLE chats ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'anonymous'`);
    }
  } catch (error) {
    console.error("Failed to add owner_id column to chats table:", error);
  }

  sqlite.exec(`

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx
      ON messages(chat_id, created_at);

    CREATE INDEX IF NOT EXISTS chats_updated_at_idx
      ON chats(updated_at DESC);
  `);

  db = drizzle(sqlite, { schema });
} catch (error) {
  dbInitError = error instanceof Error ? error : new Error("Failed to initialize database");
  console.error("Failed to initialize Vaultr database", dbInitError);
}

export class DatabaseUnavailableError extends Error {
  constructor(message = "Vaultr database is unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/** Return the initialized Drizzle database or throw a typed availability error. */
export function getDb() {
  if (!db) {
    throw new DatabaseUnavailableError(dbInitError?.message || "Vaultr database is unavailable");
  }

  return db;
}

/** Return the initialization error captured while opening the local database. */
export function getDbInitError() {
  return dbInitError;
}
