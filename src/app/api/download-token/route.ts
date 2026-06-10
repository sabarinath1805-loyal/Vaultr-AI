/**
 * Issue a short-lived signed download token for /api/download/{filename}.
 *
 * Token is bound to (userId, filename), expires after 60s, and is single-use.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { issueDownloadToken } from "@/lib/download-tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const filename = typeof body?.filename === "string" ? body.filename : "";
    if (!filename || /[/\\]/.test(filename) || filename.startsWith(".")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const issued = issueDownloadToken(userId, filename);
    return NextResponse.json(issued);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to issue token" }, { status: 500 });
  }
}
