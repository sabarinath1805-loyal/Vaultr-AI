import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { consumeDownloadToken } from "@/lib/download-tokens";

export const runtime = "nodejs";

const DOWNLOAD_ROOT =
  process.env.DOWNLOAD_DIR || path.join(process.env.TMPDIR || process.cwd(), "vaultr-downloads");

function ensureDir(dir: string) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch { /* ignore */ }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const token = request.nextUrl.searchParams.get("token");

  let userId: string;
  try {
    const auth = await requireAuth(request);
    userId = auth.userId;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!filename || /[/\\]/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (filename.includes("..") || filename.startsWith(".")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Check signed token
  if (!token || !consumeDownloadToken(token, userId, filename)) {
    return NextResponse.json({ error: "Invalid or expired download token" }, { status: 403 });
  }

  const userDir = path.join(DOWNLOAD_ROOT, "users", userId);
  ensureDir(userDir);
  const filePath = path.join(userDir, filename);

  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(userDir);
  if (!resolvedPath.startsWith(resolvedDir)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
