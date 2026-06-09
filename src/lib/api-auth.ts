/**
 * Shared authentication helpers for API routes.
 *
 * This module provides:
 * - requireAuth: Returns authenticated user or throws with appropriate status
 * - validateRequestSize: Enforces request body size limits (50KB default)
 * - sanitizeInput: Basic input sanitization for user-provided strings
 */

import { getSessionUser, isSupabaseConfigured } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MAX_REQUEST_SIZE = 50 * 1024; // 50KB

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
 * Require authentication for an API route. Reads the `Authorization: Bearer <jwt>` header, validates it with Supabase, and returns the authenticated user.
 *
 * @param req - The incoming `Request`. Must include a `Bearer` token in the `Authorization` header.
 * @returns A `{ userId, email }` object identifying the authenticated user.
 * @throws AuthError(503) if Supabase is not configured.
 * @throws AuthError(401) if the header is missing, malformed, or the token does not resolve to a valid user.
 */
export async function requireAuth(req: Request): Promise<{
  userId: string;
  email: string;
}> {
  if (!isSupabaseConfigured()) {
    // When Supabase is not configured, this is a development-only mode.
    // For security, we reject all authenticated endpoints in production scenarios.
    // In development, you can explicitly set skipAuthCheck=true in .env to bypass,
    // but this is not recommended for production.
    if (process.env.SKIP_AUTH_CHECK === "true") {
      throw new AuthError(401, "Authentication not allowed in secure mode");
    }
    throw new AuthError(503, "Authentication service not configured");
  }

  const authHeader = req.headers.get("authorization");
  const user = await getSessionUser(authHeader);

  if (!user || !user.id) {
    throw new AuthError(401, "Authentication required");
  }

  return {
    userId: user.id,
    email: user.email || "",
  };
}

/**
 * Validate the size of a request body. Uses the `Content-Length` header first, then falls back to reading the body (via `req.clone()`) to handle chunked requests with no `Content-Length`.
 *
 * @param req - The incoming `Request`.
 * @returns A 413 `NextResponse` if the body exceeds the 50KB cap, otherwise `null` to indicate the request should proceed.
 */
export async function validateRequestSize(req: Request): Promise<NextResponse | null> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / 1024}KB.` },
        { status: 413 }
      );
    }
  }

  // Also check actual body size as fallback
  try {
    const cloned = req.clone();
    const text = await cloned.text();
    if (text.length > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / 1024}KB.` },
        { status: 413 }
      );
    }
  } catch (error) {
    // If we can't read the body, let the route handler deal with it
  }

  return null;
}

/**
 * Sanitize a user-provided string for safe inclusion in HTML, JSON, or SQL. Strips C0/C1 control characters (preserving newlines and tabs), caps length, and trims.
 *
 * @param input - The raw user-supplied string.
 * @param maxLength - Maximum length in characters. Defaults to 1000.
 * @returns The sanitized string, or `""` if `input` is not a string.
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";

  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Check whether a string is a valid lowercase or uppercase UUID v4.
 *
 * @param id - The candidate id.
 * @returns `true` if `id` matches the canonical UUID v4 format, `false` otherwise (including non-string input).
 */
export function isValidUUID(id: string): boolean {
  if (typeof id !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
