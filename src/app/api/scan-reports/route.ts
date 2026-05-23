import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { getVaultrDataDir, getVaultrDbPath } from "@/lib/tauri-env";
import type { ContractAnalysis } from "@/lib/contract-scanner";
import { getRiskCounts } from "@/lib/contract-scanner";
import type { ScanReportEntry } from "@/lib/scan-reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dataDir = getVaultrDataDir();
const dbPath = getVaultrDbPath();
const SCAN_REPORT_COLUMNS = [
  "id",
  "filename",
  "created_at",
  "high_count",
  "medium_count",
  "standard_count",
  "report_json",
] as const;
const SCAN_REPORT_SELECT = SCAN_REPORT_COLUMNS.join(", ");

function getString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function getNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function openScanReportsDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS scan_reports (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      created_at TEXT NOT NULL,
      high_count INTEGER,
      medium_count INTEGER,
      standard_count INTEGER,
      report_json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS scan_reports_filename_unique
      ON scan_reports(filename);
  `);
  migrateScanReportsTable(sqlite);
  return sqlite;
}

function migrateScanReportsTable(sqlite: Database.Database) {
  const rows = sqlite.prepare("PRAGMA table_info(scan_reports)").all() as Array<{
    name: string;
  }>;
  const existingColumns = new Set(rows.map((row) => row.name));
  const missingColumns = SCAN_REPORT_COLUMNS.filter((column) => !existingColumns.has(column));
  if (missingColumns.length === 0) return;

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE scan_reports_next (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        created_at TEXT NOT NULL,
        high_count INTEGER,
        medium_count INTEGER,
        standard_count INTEGER,
        report_json TEXT NOT NULL
      );
    `);
    const selectExpression = SCAN_REPORT_COLUMNS.map((column) => {
      if (existingColumns.has(column)) return column;
      if (column === "id") return "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))";
      if (column === "filename") return "'Untitled scan report'";
      if (column === "created_at") return "datetime('now')";
      if (column === "report_json") return "'{}'";
      return "0";
    }).join(", ");

    sqlite.exec(`
      INSERT OR IGNORE INTO scan_reports_next (${SCAN_REPORT_SELECT})
      SELECT ${selectExpression}
      FROM scan_reports;
      DROP TABLE scan_reports;
      ALTER TABLE scan_reports_next RENAME TO scan_reports;
      CREATE UNIQUE INDEX IF NOT EXISTS scan_reports_filename_unique
        ON scan_reports(filename);
    `);
  })();
}

interface ScanReportRow {
  id: string;
  filename: string;
  created_at: string;
  high_count: number | null;
  medium_count: number | null;
  standard_count: number | null;
  report_json: string;
}

interface SqliteErrorLike extends Error {
  code?: string;
}

function toClientReport(row: ScanReportRow): ScanReportEntry {
  const normalized = row as unknown as Record<string, unknown>;
  const filename = getString(normalized, ["filename", "file_name", "name"]);
  const createdAt = getString(normalized, ["created_at", "createdAt", "date"]);
  const reportJson = getString(normalized, ["report_json", "reportJson", "content"]);
  const highCount = getNumber(normalized, ["high_count", "highCount"]);
  const mediumCount = getNumber(normalized, ["medium_count", "mediumCount"]);
  const standardCount = getNumber(normalized, ["standard_count", "standardCount"]);
  const parsedReport = parseReportJson(reportJson);
  return {
    id: getString(normalized, ["id"]),
    title: `Scan: ${filename}`,
    type: "scan_report",
    date: createdAt,
    content: reportJson,
    filename,
    overallRisk: parsedReport?.overall_risk,
    highCount: highCount ?? 0,
    mediumCount: mediumCount ?? 0,
    standardCount: standardCount ?? 0,
  };
}

export async function GET() {
  const sqlite = openScanReportsDb();
  try {
    const rows = sqlite
      .prepare(
        `SELECT ${SCAN_REPORT_SELECT}
         FROM scan_reports
         ORDER BY created_at DESC`
      )
      .all() as ScanReportRow[];
    const countRow = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM scan_reports`)
      .get() as { count: number };

    return NextResponse.json({ reports: rows.map(toClientReport), count: countRow.count });
  } finally {
    sqlite.close();
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Valid JSON body is required" }, { status: 400 });
  }
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const report = isContractAnalysis(body.report) ? body.report : undefined;
  const reportJson = getReportJson(body, report);

  if (!filename || !reportJson) {
    return NextResponse.json({ error: "filename and report_json are required" }, { status: 400 });
  }

  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : uuidv4();
  const createdAt =
    typeof body.created_at === "string" && body.created_at.trim()
      ? body.created_at.trim()
      : typeof body.createdAt === "string" && body.createdAt.trim()
        ? body.createdAt.trim()
        : new Date().toISOString();
  const parsedReport = report || parseReportJson(reportJson);
  const computedCounts =
    parsedReport && Array.isArray(parsedReport.clauses)
      ? getRiskCounts(parsedReport.clauses)
      : { high: 0, medium: 0, standard: 0 };
  const highCount =
    typeof body.high_count === "number" ? body.high_count : computedCounts.high;
  const mediumCount =
    typeof body.medium_count === "number" ? body.medium_count : computedCounts.medium;
  const standardCount =
    typeof body.standard_count === "number"
      ? body.standard_count
      : computedCounts.standard;
  const sqlite = openScanReportsDb();

  try {
    sqlite
      .prepare(
        `INSERT INTO scan_reports
          (id, filename, created_at, high_count, medium_count, standard_count, report_json)
         VALUES
          (@id, @filename, @createdAt, @highCount, @mediumCount, @standardCount, @reportJson)`
      )
      .run({
        id,
        filename,
        createdAt,
        highCount,
        mediumCount,
        standardCount,
        reportJson,
      });

    return NextResponse.json({
      report: {
        id,
        title: `Scan: ${filename}`,
        type: "scan_report",
        date: createdAt,
        content: reportJson,
        filename,
        overallRisk: parsedReport?.overall_risk,
        highCount,
        mediumCount,
        standardCount,
      } satisfies ScanReportEntry,
    });
  } catch (error) {
    const sqliteError = error as SqliteErrorLike;
    if (sqliteError?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const existing = sqlite
        .prepare(
          `SELECT ${SCAN_REPORT_SELECT}
           FROM scan_reports
           WHERE filename = ?`
        )
        .get(filename) as ScanReportRow | undefined;

      return NextResponse.json({
        duplicate: true,
        message: "This document is already in your Vault.",
        report: existing ? toClientReport(existing) : null,
      });
    }
    throw error;
  } finally {
    sqlite.close();
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const sqlite = openScanReportsDb();
  try {
    sqlite.prepare("DELETE FROM scan_reports WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } finally {
    sqlite.close();
  }
}

function parseReportJson(reportJson: string): ContractAnalysis | null {
  try {
    const parsed = JSON.parse(reportJson);
    return isContractAnalysis(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getReportJson(
  body: Record<string, unknown>,
  report: ContractAnalysis | undefined
) {
  if (typeof body.report_json === "string") return body.report_json;
  if (typeof body.reportJson === "string") return body.reportJson;
  if (report) return JSON.stringify(report);
  if (typeof body.content === "string") return body.content;
  return "";
}

function isContractAnalysis(value: unknown): value is ContractAnalysis {
  if (!isRecord(value)) return false;
  return Array.isArray(value.clauses);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
