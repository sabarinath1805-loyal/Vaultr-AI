/**
 * Tiny structured logger.
 *
 * Wraps `console.info` / `console.error` / `console.warn` so that callers can attach a
 * `scope` tag and key/value context without inlining `console.error(...)`
 * everywhere. The format mirrors what server-side routes already emit:
 *   [scope] message { key: value, ... }
 *
 * Browser-only; on the server this still routes through the global
 * `console`, which is what Next.js / Vercel capture by default.
 */

export type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return "";
  try {
    return " " + JSON.stringify(context);
  } catch {
    // Cycles, BigInt, etc. — fall back to a safe stringified form.
    return " " + String(context);
  }
}

/** Write an informational event with an explicit application scope. */
export function logInfo(scope: string, message: string, context?: LogContext): void {
  console.info(`[${scope}] ${message}${formatContext(context)}`);
}

/** Write an error event and preserve useful error details when provided. */
export function logError(scope: string, message: string, context?: LogContext | unknown): void {
  // Some callers pass the raw error as the 3rd arg; coerce to a sensible object.
  const ctx: LogContext | undefined =
    context === undefined
      ? undefined
      : context instanceof Error
        ? { name: context.name, message: context.message, stack: context.stack }
        : (context as LogContext);
  console.error(`[${scope}] ${message}${formatContext(ctx)}`);
}

/** Write a warning event with an explicit application scope. */
export function logWarn(scope: string, message: string, context?: LogContext | unknown): void {
  const ctx: LogContext | undefined =
    context === undefined
      ? undefined
      : context instanceof Error
        ? { name: context.name, message: context.message }
        : (context as LogContext);
  console.warn(`[${scope}] ${message}${formatContext(ctx)}`);
}
