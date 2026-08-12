import { randomUUID } from "crypto";
import { mkdir, open, readdir, stat, unlink } from "fs/promises";
import type { FileHandle } from "fs/promises";
import path from "path";

type RawStreamEntry = {
  timestamp: string;
  iteration: number;
  label: string;
  payload: unknown;
};

function rawStreamLogDir(): string | null {
  const dir = process.env.RAW_LLM_STREAM_LOG_DIR?.trim() || null;
  return dir && path.isAbsolute(dir) ? dir : null;
}

function rawLoggingAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.LOG_RAW_LLM_STREAM === "true";
}

function includeContent() {
  return process.env.LOG_RAW_LLM_STREAM_INCLUDE_CONTENT === "true";
}

function privacySafePayload(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  if (/authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|cookie|secret/i.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    if (!includeContent() && /content|prompt|message|input|output|text|body/i.test(key)) {
      return `[CONTENT REDACTED length=${value.length}]`;
    }
    return value.length > 2_000 && !includeContent()
      ? `${value.slice(0, 2_000)}…[TRUNCATED length=${value.length}]`
      : value;
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: privacySafePayload(value.message, "message", seen),
      stack: privacySafePayload(value.stack, "stack", seen),
    };
  }
  if (Array.isArray(value)) return value.map((item) => privacySafePayload(item, key, seen));
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      privacySafePayload(childValue, childKey, seen),
    ]),
  );
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function stringifyJson(value: unknown) {
  const safeValue = privacySafePayload(value);
  return JSON.stringify(safeValue, (_key, innerValue: unknown) => {
    if (typeof innerValue === "bigint") return innerValue.toString();
    return innerValue;
  });
}

export function logRawLlmStream(args: {
  provider: string;
  model: string;
  iteration: number;
  label: string;
  payload: unknown;
}) {
  if (!rawLoggingAllowed()) return;

  console.log(
    `[raw-llm-stream:${args.provider}:${args.model}:iter-${args.iteration}] ${args.label}`,
  );
  console.dir(privacySafePayload(args.payload), { depth: null, maxArrayLength: 100 });
}

export function createRawLlmStreamRecorder(args: {
  provider: string;
  model: string;
}) {
  const dir = rawStreamLogDir();
  if (!dir || !rawLoggingAllowed()) return null;
  const logDir = dir;

  const startedAt = new Date();
  const id = randomUUID();
  const filename = [
    safeFilePart(args.provider),
    safeFilePart(args.model),
    startedAt.toISOString().replace(/[:.]/g, "-"),
    id,
  ].join("-");
  const filePath = path.join(logDir, `${filename}.raw-llm-stream.json`);
  let fileHandle: FileHandle | null = null;
  let writeChain: Promise<void> = Promise.resolve();
  let writeError: unknown = null;
  let wroteEntry = false;
  let finalized = false;

  async function ensureOpen() {
    if (fileHandle) return fileHandle;
    await mkdir(logDir, { recursive: true });
    await pruneOldLogs(logDir);
    fileHandle = await open(filePath, "wx", 0o600);
    const header = {
      id,
      provider: args.provider,
      model: args.model,
      startedAt: startedAt.toISOString(),
    };
    await fileHandle.write(`${stringifyJson(header)?.slice(0, -1)},"entries":[`);
    return fileHandle;
  }

  function queueWrite(action: () => Promise<void>) {
    writeChain = writeChain
      .then(action)
      .catch((error) => {
        writeError = error;
        console.error("[raw-llm-stream] failed to write log file", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  return {
    record(entry: Omit<RawStreamEntry, "timestamp">) {
      if (finalized) return;
      const rawEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
      };
      queueWrite(async () => {
        const handle = await ensureOpen();
        const serialized =
          stringifyJson(rawEntry) ??
          stringifyJson({
            timestamp: rawEntry.timestamp,
            iteration: rawEntry.iteration,
            label: rawEntry.label,
            payload: "[Unserializable payload]",
          });
        await handle.write(`${wroteEntry ? "," : ""}${serialized}`);
        wroteEntry = true;
      });
    },
    async flush(status: "completed" | "error", error?: unknown) {
      if (finalized) return;
      finalized = true;
      const errorPayload =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error
          ? { message: String(error) }
          : undefined;

      const footer = {
        finishedAt: new Date().toISOString(),
        status,
        error: errorPayload,
      };

      try {
        await writeChain;
        const handle = await ensureOpen();
        await handle.write(`],${stringifyJson(footer)?.slice(1)}\n`);
      } catch (writeError) {
        console.error("[raw-llm-stream] failed to write log file", {
          filePath,
          error:
            writeError instanceof Error
              ? writeError.message
              : String(writeError),
        });
      } finally {
        if (fileHandle) {
          await fileHandle.close().catch(() => {});
          fileHandle = null;
        }
        if (writeError) {
          console.error("[raw-llm-stream] log file may be incomplete", {
            filePath,
          });
        }
      }
    },
  };
}

async function pruneOldLogs(logDir: string) {
  const configuredDays = Number(process.env.RAW_LLM_STREAM_LOG_RETENTION_DAYS);
  const retentionDays = Number.isFinite(configuredDays) && configuredDays >= 1 && configuredDays <= 30
    ? configuredDays
    : 7;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(logDir, { withFileTypes: true });
  const files: { path: string; mtimeMs: number }[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".raw-llm-stream.json")) continue;
    const filePath = path.join(logDir, entry.name);
    const details = await stat(filePath).catch(() => null);
    if (!details) continue;
    if (details.mtimeMs < cutoff) {
      await unlink(filePath).catch(() => {});
      continue;
    }
    files.push({ path: filePath, mtimeMs: details.mtimeMs });
  }
  for (const file of files.sort((a, b) => a.mtimeMs - b.mtimeMs).slice(0, Math.max(0, files.length - 100))) {
    await unlink(file.path).catch(() => {});
  }
}
