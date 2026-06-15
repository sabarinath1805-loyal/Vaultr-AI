import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/document-extraction";
import { requireAuth, validateRequestSize, AuthError } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IP-based rate limiting: 10 requests/minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Opportunistic cleanup: drop entries whose window has elapsed
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip")?.trim() ||
         "127.0.0.1";
}

export async function POST(req: Request) {
  // Rate limit check
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Auth gate
  try {
    await requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body size (10MB limit)
    const sizeError = await validateRequestSize(req);
    if (sizeError) return sizeError;

    const body = await req.json();
    const { filename, fileType, content, dataUrl } = body;

    if (!filename || (!content && !dataUrl)) {
      return NextResponse.json(
        { error: "filename and content or dataUrl are required" },
        { status: 400 }
      );
    }

    const extractedText = await extractDocumentText({
      filename,
      fileType,
      content,
      dataUrl,
    });

    return NextResponse.json({ extractedText: extractedText || "" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    console.error("Document extraction failed:", error);
    return NextResponse.json(
      { error: "Document extraction failed", extractedText: "" },
      { status: 500 }
    );
  }
}
