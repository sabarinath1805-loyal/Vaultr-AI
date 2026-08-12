import { createHash } from "node:crypto";

export type AuditEventAction =
  | "account.delete"
  | "account.export"
  | "project.share"
  | "project.delete"
  | "project.export"
  | "document.delete"
  | "document.export"
  | "document.quarantine"
  | "document.scan.failure"
  | "document.processing.blocked"
  | "provider.api_key.change"
  | "mcp.connector.change"
  | "mfa.change";

export type AuditEventInput = {
  userId: string | null;
  action: AuditEventAction;
  resourceType: string;
  resourceId?: string | null;
  success: boolean;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY = /token|secret|password|authorization|api[_-]?key|cookie|encrypted|iv|tag/i;

function safeMetadata(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeMetadata(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 40).map(([childKey, childValue]) => [
        childKey,
        safeMetadata(childValue, childKey),
      ]),
    );
  }
  return value;
}

export function createAuditEvent(input: AuditEventInput) {
  return {
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    success: input.success,
    request_id: input.requestId ?? null,
    metadata: safeMetadata(input.metadata ?? {}),
    occurred_at: new Date().toISOString(),
  };
}

export async function recordAuditEvent(
  db: { from: (table: string) => unknown },
  input: AuditEventInput,
) {
  const row = createAuditEvent(input);
  try {
    const query = db.from("audit_events") as {
      insert: (value: unknown) => PromiseLike<{ error?: { message?: string } | null }>;
    };
    const result = await query.insert(row);
    if (result.error) {
      console.error("[audit-event] durable write failed", {
        action: input.action,
        resourceType: input.resourceType,
        error: result.error.message ?? "unknown",
      });
    }
  } catch (error) {
    // Audit recording must not turn a successful user action into a 500 while
    // a deployment is being migrated. The structured error remains observable.
    console.error("[audit-event] durable write failed", {
      action: input.action,
      resourceType: input.resourceType,
      error: error instanceof Error ? error.message : String(error),
      fingerprint: createHash("sha256").update(String(error)).digest("hex").slice(0, 12),
    });
  }
}
