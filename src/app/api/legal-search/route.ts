import { NextRequest, NextResponse } from "next/server";
import { searchLegalDatabases } from "@/lib/legal-search";
import { requireAuth, AuthError } from "@/lib/api-auth";

const MAX_BODY_SIZE = 10 * 1024; // 10KB
const RATE_LIMIT_CAP = 5000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

// IP-based rate limiting with LRU cap and periodic sweep.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let sweepCounter = 0;

function sweepExpired(now: number) {
  sweepCounter++;
  if (sweepCounter % 256 === 0) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
    if (rateLimitMap.size > RATE_LIMIT_CAP) {
      const overflow = rateLimitMap.size - RATE_LIMIT_CAP;
      let dropped = 0;
      for (const k of rateLimitMap.keys()) {
        rateLimitMap.delete(k);
        if (++dropped >= overflow) break;
      }
    }
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  sweepExpired(now);
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
  // Require auth — this is a PII route (legal queries can name parties).
  try {
    await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

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
