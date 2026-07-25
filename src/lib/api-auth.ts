/**
 * Shared authentication helpers for API routes.
 *
 * This module provides:
 * - requireAuth: Returns authenticated user or throws with appropriate status
 * - validateRequestSize: Enforces request body size limits (50KB default)
 * - sanitizeInput: Basic input sanitization for user-provided strings
 *
 * Boot guard: when NODE_ENV=production and Supabase is not configured, this
 * module throws on import. That is the only way to ensure we never start a
 * production server that silently allows anonymous access.
 */

import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MAX_REQUEST_SIZE = 50 * 1024; // 50KB

// Hard-fail boot: production must have Supabase configured.
if (process.env.NODE_ENV === "production" && !isSupabaseConfigured()) {
  throw new Error(
    "Vaultr refuses to start: NEXT_PUBLIC_SUPABASE_URL is required in production. " +
      "Set Supabase environment variables or run with NODE_ENV=development."
  );
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public userMessage: string
  ) {
    super(userMessage);
    this.name = "AuthError";
  }
}

/**
 * Require authentication for an API route.
 */
export async function requireAuth(req: Request): Promise<{ userId: string; email: string }> {
  if (!isSupabaseConfigured()) {
    // Production must use real Supabase auth — the boot guard above
    // already throws on import in that case, so this branch is only
    // reachable in dev/staging/local.
    if (process.env.NODE_ENV === "production") {
      throw new AuthError(503, "Authentication service not configured");
    }
    // Private-mode fallback: derive a per-machine stable identity.
    // The DB layer treats owner_id as opaque TEXT, so the synthetic
    // UUID flows through unmodified. See src/lib/local-user.ts.
    const { localUser } = await import("@/lib/local-user");
    return { userId: localUser.userId, email: localUser.email };
  }

  const authHeader = req.headers.get("authorization");

  const user = await getSessionUser(authHeader);

  if (!user || !user.id) {
    throw new AuthError(401, "Authentication required");
  }

  return { userId: user.id, email: user.email || "" };
}

/**
 * Validate request body size.
 */
export async function validateRequestSize(
  req: Request,
  maxBytes: number = MAX_REQUEST_SIZE
): Promise<NextResponse | null> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxBytes) {
      return NextResponse.json(
        { error: `Request body too large. Maximum size is ${maxBytes / 1024}KB.` },
        { status: 413 }
      );
    }
  }

  try {
    const cloned = req.clone();
    const text = await cloned.text();
    if (text.length > maxBytes) {
      return NextResponse.json(
        { error: `Request body too large. Maximum size is ${maxBytes / 1024}KB.` },
        { status: 413 }
      );
    }
  } catch {
    // Let route handler deal with it
  }
  return null;
}

/**
 * Sanitize string with NFKC normalize, zero-width strip, control-char strip.
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";

  // NFKC normalize
  let sanitized = input.normalize("NFKC");

  // Strip zero-width chars and bidi overrides
  sanitized = sanitized.replace(/[​-‍⁠﻿‪-‮⁦-⁩]/g, "");

  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  if (sanitized.length > maxLength) sanitized = sanitized.slice(0, maxLength);
  return sanitized.trim();
}

export function isValidUUID(id: string): boolean {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}