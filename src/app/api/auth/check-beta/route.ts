import { isBetaUser } from "@/lib/supabase";
import { NextResponse } from "next/server";

// IP-based rate limiting: 5 requests/minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
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

export async function POST(req: Request) {
  // Rate limit check
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({ approved: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ approved: false, error: "Invalid request body" }, { status: 400 });
    }
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ approved: false, error: "Missing email" }, { status: 400 });
    }

    // Basic email format check to reduce probe attempts
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ approved: false, error: "Invalid email" }, { status: 400 });
    }

    const approved = await isBetaUser(email);
    return NextResponse.json({ approved });
  } catch (error) {
    console.error("[check-beta] Error:", error);
    return NextResponse.json({ approved: false, error: "Internal error" }, { status: 500 });
  }
}
