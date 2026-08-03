/**
 * Per-machine local-user identity, used by the private-mode fallback in
 * `src/lib/api-auth.ts` when Supabase is not configured.
 *
 * The userId is a deterministic UUID v5 derived from the host's
 * machine-id (hashed), so it survives server restarts and is stable
 * across requests. Persisted to `.vaultr/local-user.json` so the
 * `createdAt` is also stable. The schema treats `owner_id` as opaque
 * TEXT with no FK to `auth.users` (see `src/lib/db/schema.ts`), so a
 * locally generated UUID is safe to use as `userId`.
 *
 * This module is intentionally lazy-loaded by `requireAuth` via a
 * dynamic import — that lets `next dev` start even when the
 * `node-machine-id` package is not yet installed (it's a new dep and
 * will be picked up on the next `pnpm install`). When the import
 * inside `loadOrCreate` fails, we fall back to a process-random UUID
 * and warn once; the app stays usable.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { v5 as uuidv5 } from "uuid";
import { getVaultrDataDir } from "@/lib/tauri-env";

const LOCAL_USER_FILE = "local-user.json";

// Random namespace UUID — generated once and hard-coded so UUIDs are
// reproducible across machines. This is the standard UUID v5 pattern
// (RFC 4122): a UUID does not need to be in any registry, only stable.
const NAMESPACE = "5f6b8a3c-9e2d-4d1a-8c7b-1a2b3c4d5e6f";

interface LocalUser {
  userId: string;
  email: string;
  createdAt: number;
}

let warnedAboutMachineId = false;

function deriveMachineId(): string {
  try {
    // Lazy require so the module is optional. node-machine-id is pure-JS
    // (no native binding); on Windows it reads the MachineGuid from
    // HKLM\SOFTWARE\Microsoft\Cryptography. `true` returns the hashed
    // form so the raw GUID never leaves the process.
    const { machineIdSync } = require("node-machine-id") as {
      machineIdSync: (hashed?: boolean) => string;
    };
    return machineIdSync(true);
  } catch (error) {
    if (!warnedAboutMachineId) {
      console.warn(
        "[local-user] node-machine-id not available — using a per-process random seed. " +
          "The userId will change on every server restart until `pnpm add node-machine-id` is run. " +
          `Underlying error: ${(error as Error).message}`
      );
      warnedAboutMachineId = true;
    }
    return createHash("sha256")
      .update(`${process.pid}-${Date.now()}-${Math.random()}`)
      .digest("hex");
  }
}

function loadOrCreate(): LocalUser {
  const dir = getVaultrDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, LOCAL_USER_FILE);

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<LocalUser>;
    if (
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.createdAt === "number"
    ) {
      return parsed as LocalUser;
    }
  } catch {
    // Missing or unreadable — fall through to creation.
  }

  const seed = deriveMachineId();
  const userId = uuidv5(seed, NAMESPACE);
  const user: LocalUser = {
    userId,
    email: `local@${seed.slice(0, 8)}.local`,
    createdAt: Date.now(),
  };

  try {
    fs.writeFileSync(file, JSON.stringify(user, null, 2));
  } catch (error) {
    console.warn(
      `[local-user] Could not persist ${file}: ${(error as Error).message}. ` +
        "Identity will be regenerated on next restart."
    );
  }

  return user;
}

export const localUser: Readonly<LocalUser> = Object.freeze(loadOrCreate());
