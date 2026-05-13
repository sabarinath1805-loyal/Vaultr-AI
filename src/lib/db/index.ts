import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), ".vaultr");
const dbPath = path.join(dataDir, "vaultr.db");

fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

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

export const db = drizzle(sqlite, { schema });
