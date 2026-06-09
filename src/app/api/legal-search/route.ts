import { NextRequest, NextResponse } from "next/server";
import { searchLegalDatabases } from "@/lib/legal-search";

const MAX_BODY_SIZE = 10 * 1024; // 10KB

// IP-based rate limiting: 20 requests/minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
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

export async function POST(request: NextRequest) {
  // Rate limit check
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Body size check
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const { query, jurisdiction } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    // Validate input length
    if (query.length > 200) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 });
    }

    const results = await searchLegalDatabases(query, jurisdiction);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Legal search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
