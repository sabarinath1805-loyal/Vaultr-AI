import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import Database from "better-sqlite3";
import fs from "fs";
import { getVaultrDbPath } from "@/lib/tauri-env";
import { LocalProject } from "@/lib/local-documents";

const dbPath = getVaultrDbPath();

interface LocalMatterRow {
  id: string;
  name: string;
  cm_number: string | null;
  document_ids: string;
  created_at: string;
}

function openLocalVaultDb() {
  const sqlite = new Database(dbPath);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS local_vault_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cm_number TEXT,
      document_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      owner_id TEXT NOT NULL DEFAULT 'anonymous'
    );
  `);
  return sqlite;
}

export async function GET(req: Request) {
  // Require auth
  let userId: string;
  try {
    const authResult = await requireAuth(req);
    userId = authResult.userId;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sqlite = openLocalVaultDb();
  try {
    const matters = sqlite
      .prepare(
        `SELECT id, name, cm_number, document_ids, created_at
         FROM local_vault_projects
         WHERE owner_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as LocalMatterRow[];

    return NextResponse.json({
      matters: matters.map(row => ({
        id: row.id,
        name: row.name,
        cmNumber: row.cm_number,
        documentIds: parseDocumentIds(row.document_ids),
        createdAt: row.created_at,
      })),
    });
  } finally {
    sqlite.close();
  }
}

function parseDocumentIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}