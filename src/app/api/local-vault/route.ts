import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import { getVaultrDataDir, getVaultrDbPath } from "@/lib/tauri-env";
import type { LocalDocument, LocalProject } from "@/lib/local-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dataDir = getVaultrDataDir();
const dbPath = getVaultrDbPath();

interface LocalVaultRow {
  id: string;
  filename: string;
  file_type: string | null;
  size_bytes: number;
  created_at: string;
  project_id: string | null;
  content: string | null;
  data_url: string | null;
}

interface LocalVaultProjectRow {
  id: string;
  name: string;
  cm_number: string | null;
  document_ids: string;
  created_at: string;
}

function openLocalVaultDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS local_vault_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      file_type TEXT,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      project_id TEXT,
      content TEXT,
      data_url TEXT
    );

    CREATE TABLE IF NOT EXISTS local_vault_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cm_number TEXT,
      document_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS local_vault_documents_project_idx
      ON local_vault_documents(project_id);
  `);
  return sqlite;
}

export async function GET() {
  const sqlite = openLocalVaultDb();
  try {
    const documents = sqlite
      .prepare(
        `SELECT id, filename, file_type, size_bytes, created_at, project_id, content, data_url
         FROM local_vault_documents
         ORDER BY created_at DESC`
      )
      .all() as LocalVaultRow[];
    const projects = sqlite
      .prepare(
        `SELECT id, name, cm_number, document_ids, created_at
         FROM local_vault_projects
         ORDER BY created_at DESC`
      )
      .all() as LocalVaultProjectRow[];

    return NextResponse.json({
      documents: documents.map(toClientDocument),
      projects: projects.map(toClientProject),
    });
  } finally {
    sqlite.close();
  }
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Valid JSON body is required" }, { status: 400 });
  }

  const documents = Array.isArray(body.documents)
    ? body.documents.filter(isLocalDocument)
    : [];
  const projects = Array.isArray(body.projects) ? body.projects.filter(isLocalProject) : [];
  const sqlite = openLocalVaultDb();

  try {
    sqlite.transaction(() => {
      sqlite.prepare("DELETE FROM local_vault_documents").run();
      sqlite.prepare("DELETE FROM local_vault_projects").run();

      const insertDocument = sqlite.prepare(
        `INSERT INTO local_vault_documents
          (id, filename, file_type, size_bytes, created_at, project_id, content, data_url)
         VALUES
          (@id, @filename, @fileType, @sizeBytes, @createdAt, @projectId, @content, @dataUrl)`
      );
      for (const document of documents) {
        insertDocument.run({
          id: document.id,
          filename: document.filename,
          fileType: document.fileType,
          sizeBytes: document.sizeBytes,
          createdAt: document.createdAt,
          projectId: document.projectId,
          content: document.content ?? null,
          dataUrl: document.dataUrl ?? null,
        });
      }

      const insertProject = sqlite.prepare(
        `INSERT INTO local_vault_projects
          (id, name, cm_number, document_ids, created_at)
         VALUES
          (@id, @name, @cmNumber, @documentIds, @createdAt)`
      );
      for (const project of projects) {
        insertProject.run({
          id: project.id,
          name: project.name,
          cmNumber: project.cmNumber,
          documentIds: JSON.stringify(project.documentIds),
          createdAt: project.createdAt,
        });
      }
    })();

    return NextResponse.json({ ok: true });
  } finally {
    sqlite.close();
  }
}

function toClientDocument(row: LocalVaultRow): LocalDocument {
  return {
    id: row.id,
    filename: row.filename,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    projectId: row.project_id,
    content: row.content ?? undefined,
    dataUrl: row.data_url ?? undefined,
  };
}

function toClientProject(row: LocalVaultProjectRow): LocalProject {
  return {
    id: row.id,
    name: row.name,
    cmNumber: row.cm_number,
    documentIds: parseDocumentIds(row.document_ids),
    createdAt: row.created_at,
  };
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

function isLocalDocument(value: unknown): value is LocalDocument {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.filename === "string" &&
    typeof value.sizeBytes === "number" &&
    typeof value.createdAt === "string" &&
    (typeof value.fileType === "string" || value.fileType === null) &&
    (typeof value.projectId === "string" || value.projectId === null)
  );
}

function isLocalProject(value: unknown): value is LocalProject {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.documentIds) &&
    (typeof value.cmNumber === "string" || value.cmNumber === null) &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
