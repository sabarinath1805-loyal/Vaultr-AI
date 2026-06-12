import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import { getVaultrDataDir, getVaultrDbPath } from "@/lib/tauri-env";
import type { LocalDocument, LocalProject } from "@/lib/local-documents";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { ingestDocument } from "@/lib/rag-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dataDir = getVaultrDataDir();
const dbPath = getVaultrDbPath();
const MAX_PUT_BODY_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_DOCUMENTS = 1000;
const MAX_PROJECTS = 200;

interface LocalVaultRow {
  id: string;
  filename: string;
  file_type: string | null;
  size_bytes: number;
  created_at: string;
  project_id: string | null;
  owner_id: string;
  content: string | null;
  data_url: string | null;
}

interface LocalVaultProjectRow {
  id: string;
  name: string;
  cm_number: string | null;
  document_ids: string;
  created_at: string;
  owner_id: string;
}

function openLocalVaultDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(dbPath);

  // Nuclear fix: detect and drop tables missing owner_id column
  try {
    const cols = sqlite.prepare("PRAGMA table_info(local_vault_documents)").all() as { name: string }[];
    const hasOwnerId = cols.some(c => c.name === 'owner_id');
    if (!hasOwnerId && cols.length > 0) {
      sqlite.exec('DROP TABLE IF EXISTS local_vault_documents');
    }
  } catch {
    // Table doesn't exist yet
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS local_vault_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_type TEXT,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      project_id TEXT,
      owner_id TEXT NOT NULL DEFAULT 'anonymous',
      content TEXT,
      data_url TEXT
    );

    CREATE TABLE IF NOT EXISTS local_vault_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cm_number TEXT,
      document_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      owner_id TEXT NOT NULL DEFAULT 'anonymous'
    );

    CREATE INDEX IF NOT EXISTS local_vault_documents_project_idx
      ON local_vault_documents(project_id);
    CREATE INDEX IF NOT EXISTS local_vault_documents_owner_idx
      ON local_vault_documents(owner_id);
    CREATE INDEX IF NOT EXISTS local_vault_projects_owner_idx
      ON local_vault_projects(owner_id);
  `);
  // Backfill columns for older installs. Each ALTER is wrapped in its own
  // try/catch so a missing column on one table doesn't block the rest.
  const backfillColumn = (table: string, column: string, ddl: string) => {
    try {
      sqlite.exec(ddl);
    } catch {
      // Column already exists, or table missing — both are fine.
    }
  };
  backfillColumn(
    "local_vault_documents",
    "owner_id",
    `ALTER TABLE local_vault_documents ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'anonymous'`
  );
  backfillColumn(
    "local_vault_documents",
    "file_size",
    `ALTER TABLE local_vault_documents ADD COLUMN file_size INTEGER`
  );
  backfillColumn(
    "local_vault_documents",
    "mime_type",
    `ALTER TABLE local_vault_documents ADD COLUMN mime_type TEXT`
  );
  backfillColumn(
    "local_vault_projects",
    "owner_id",
    `ALTER TABLE local_vault_projects ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'anonymous'`
  );
  return sqlite;
}

export async function GET(req: Request) {
  // Require auth — return only the caller's own vault.
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
    const documents = sqlite
      .prepare(
        `SELECT id, filename, file_type, size_bytes, created_at, project_id, owner_id, content, data_url
         FROM local_vault_documents
         WHERE owner_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as LocalVaultRow[];
    const projects = sqlite
      .prepare(
        `SELECT id, name, cm_number, document_ids, created_at, owner_id
         FROM local_vault_projects
         WHERE owner_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as LocalVaultProjectRow[];

    return NextResponse.json({
      documents: documents.map(toClientDocument),
      projects: projects.map(toClientProject),
    });
  } finally {
    sqlite.close();
  }
}

export async function PUT(req: Request) {
  // Require auth BEFORE doing anything else — anonymous PUT would wipe the vault.
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

  // Validate body size before parsing
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PUT_BODY_SIZE) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Valid JSON body is required" }, { status: 400 });
  }

  const documents = Array.isArray(body.documents)
    ? body.documents.filter(isLocalDocument)
    : [];
  const projects = Array.isArray(body.projects) ? body.projects.filter(isLocalProject) : [];

  if (documents.length > MAX_DOCUMENTS || projects.length > MAX_PROJECTS) {
    return NextResponse.json(
      { error: `Too many records (max ${MAX_DOCUMENTS} documents, ${MAX_PROJECTS} projects)` },
      { status: 413 }
    );
  }

  const sqlite = openLocalVaultDb();

  try {
    // Partition by owner_id: replace only this user's vault rows.
    sqlite.transaction(() => {
      sqlite.prepare("DELETE FROM local_vault_documents WHERE owner_id = ?").run(userId);
      sqlite.prepare("DELETE FROM local_vault_projects WHERE owner_id = ?").run(userId);

      const insertDocument = sqlite.prepare(
        `INSERT INTO local_vault_documents
          (id, filename, file_type, size_bytes, created_at, project_id, owner_id, content, data_url)
         VALUES
          (@id, @filename, @fileType, @sizeBytes, @createdAt, @projectId, @ownerId, @content, @dataUrl)`
      );
      for (const document of documents) {
        insertDocument.run({
          id: document.id,
          filename: document.filename,
          fileType: document.fileType,
          sizeBytes: document.sizeBytes,
          createdAt: document.createdAt,
          projectId: document.projectId,
          ownerId: userId,
          content: document.content ?? null,
          dataUrl: document.dataUrl ?? null,
        });
      }

      const insertProject = sqlite.prepare(
        `INSERT INTO local_vault_projects
          (id, name, cm_number, document_ids, created_at, owner_id)
         VALUES
          (@id, @name, @cmNumber, @documentIds, @createdAt, @ownerId)`
      );
      for (const project of projects) {
        insertProject.run({
          id: project.id,
          name: project.name,
          cmNumber: project.cmNumber,
          documentIds: JSON.stringify(project.documentIds),
          createdAt: project.createdAt,
          ownerId: userId,
        });
      }
    })();

    // Fire-and-forget: ingest documents with content for RAG embeddings
    for (const document of documents) {
      if (document.content && userId) {
        ingestDocument({
          userId,
          documentName: document.filename,
          content: document.content,
          source: "vault",
        }).catch(() => {});
      }
    }

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
