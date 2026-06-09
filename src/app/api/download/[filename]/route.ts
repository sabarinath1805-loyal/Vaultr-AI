import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";

// Configurable download directory via DOWNLOAD_DIR env var
// Defaults to system temp directory for security
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(process.env.TMPDIR || "/tmp", "vaultr-downloads");

// Ensure download directory exists
try {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
} catch (error) {
  console.error("Failed to create download directory:", error);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || /[/\\]/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Additional security: prevent path traversal
  if (filename.includes("..") || filename.startsWith(".")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(DOWNLOAD_DIR, filename);

  // Verify the resolved path is within DOWNLOAD_DIR
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(DOWNLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedDir)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
