import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import type { ContractAnalysis } from "@/lib/contract-scanner";
import { getRiskCounts } from "@/lib/contract-scanner";
import type { ScanReportEntry } from "@/lib/scan-reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dataDir = path.join(process.cwd(), ".vaultr");
const dbPath = path.join(dataDir, "vaultr.db");

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
  return sqlite;
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

function toClientReport(row: ScanReportRow): ScanReportEntry {
  return {
    id: row.id,
    title: `Scan: ${row.filename}`,
    type: "scan_report",
    date: row.created_at,
    content: row.report_json,
    filename: row.filename,
    highCount: row.high_count ?? 0,
    mediumCount: row.medium_count ?? 0,
    standardCount: row.standard_count ?? 0,
  };
}

export async function GET() {
  const sqlite = openScanReportsDb();
  try {
    const rows = sqlite
      .prepare(
        `SELECT id, filename, created_at, high_count, medium_count, standard_count, report_json
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
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const report = body?.report as ContractAnalysis | undefined;
  const reportJson =
    typeof body?.report_json === "string"
      ? body.report_json
      : report
        ? JSON.stringify(report)
        : "";

  if (!filename || !reportJson) {
    return NextResponse.json({ error: "filename and report_json are required" }, { status: 400 });
  }

  const id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : uuidv4();
  const createdAt =
    typeof body?.created_at === "string" && body.created_at.trim()
      ? body.created_at.trim()
      : typeof body?.createdAt === "string" && body.createdAt.trim()
        ? body.createdAt.trim()
        : new Date().toISOString();
  const parsedReport = report || parseReportJson(reportJson);
  const computedCounts =
    parsedReport && Array.isArray(parsedReport.clauses)
      ? getRiskCounts(parsedReport.clauses)
      : { high: 0, medium: 0, standard: 0 };
  const highCount =
    typeof body?.high_count === "number" ? body.high_count : computedCounts.high;
  const mediumCount =
    typeof body?.medium_count === "number" ? body.medium_count : computedCounts.medium;
  const standardCount =
    typeof body?.standard_count === "number"
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
        highCount,
        mediumCount,
        standardCount,
      } satisfies ScanReportEntry,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("unique")
    ) {
      const existing = sqlite
        .prepare(
          `SELECT id, filename, created_at, high_count, medium_count, standard_count, report_json
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
    return JSON.parse(reportJson) as ContractAnalysis;
  } catch {
    return null;
  }
}
