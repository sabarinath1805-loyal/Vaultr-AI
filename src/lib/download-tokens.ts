/**
 * Server-side short-lived download token store.
 *
 * Tokens are bound to (userId, filename) and expire after TOKEN_TTL_MS.
 * They are single-use: /api/download deletes the token on consumption.
 *
 * In-memory only: keys are server-generated 24-byte random strings (192 bits
 * of entropy), values are 64 bytes. The map is bounded to RATE_LIMIT_CAP
 * entries with a periodic sweep — bound by reach rather than size.
 */

import * as crypto from "crypto";

const TOKEN_TTL_MS = 60_000; // 1 minute
const RATE_LIMIT_CAP = 50_000;
const SWEEP_EVERY = 256;

interface TokenEntry {
  userId: string;
  filename: string;
  expiresAt: number;
}

const validTokens = new Map<string, TokenEntry>();
let sweepCounter = 0;

function sweep(now: number) {
  sweepCounter++;
  if (sweepCounter % SWEEP_EVERY === 0) {
    for (const [k, v] of validTokens) {
      if (now > v.expiresAt) validTokens.delete(k);
    }
    if (validTokens.size > RATE_LIMIT_CAP) {
      const overflow = validTokens.size - RATE_LIMIT_CAP;
      let dropped = 0;
      for (const k of validTokens.keys()) {
        validTokens.delete(k);
        if (++dropped >= overflow) break;
      }
    }
  }
}

export function issueDownloadToken(userId: string, filename: string): { token: string; expiresIn: number } {
  const token = crypto.randomBytes(24).toString("hex");
  validTokens.set(token, { userId, filename, expiresAt: Date.now() + TOKEN_TTL_MS });
  return { token, expiresIn: TOKEN_TTL_MS };
}

export function consumeDownloadToken(token: string, userId: string, filename: string): boolean {
  sweep(Date.now());
  const entry = validTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    validTokens.delete(token);
    return false;
  }
  if (entry.userId !== userId || entry.filename !== filename) return false;
  // Single-use
  validTokens.delete(token);
  return true;
}
