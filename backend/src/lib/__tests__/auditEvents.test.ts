import { describe, expect, it } from "vitest";
import { createAuditEvent } from "../auditEvents";

describe("audit event foundation", () => {
  it("redacts secret-like metadata and keeps event fields stable", () => {
    const event = createAuditEvent({
      userId: "u1",
      action: "provider.api_key.change",
      resourceType: "provider_key",
      resourceId: "openai",
      success: true,
      metadata: { provider: "openai", api_key: "secret", count: 1 },
    });
    expect(event).toMatchObject({
      user_id: "u1",
      action: "provider.api_key.change",
      resource_type: "provider_key",
      resource_id: "openai",
      success: true,
      metadata: { provider: "openai", api_key: "[REDACTED]", count: 1 },
    });
    expect(event.occurred_at).toEqual(expect.any(String));
  });
});
