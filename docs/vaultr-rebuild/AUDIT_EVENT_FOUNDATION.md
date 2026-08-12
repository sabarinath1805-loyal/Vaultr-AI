# Audit Event Foundation

Status: additive implementation with Phase 2 sensitive-action coverage; retention/viewer/alerting remain deployment policy.

## Event contract

`backend/src/lib/auditEvents.ts` defines a reusable event shape and non-secret metadata sanitizer. Supported action names cover account export/deletion, project export/deletion/sharing, document deletion/export/quarantine, provider-key changes, MCP connector changes, and MFA changes.

The additive `audit_events` table stores:

- actor `user_id` (nullable for system events);
- stable `action`, `resource_type`, and optional `resource_id`;
- success/failure and optional request correlation ID;
- bounded JSON metadata with credential-like keys redacted;
- server timestamp `occurred_at`.

The table has RLS enabled, direct browser grants revoked, and service-role access supplied by the fresh schema. The writer is non-blocking so a migration outage does not convert a successful user action into a 500; the structured write failure is still logged for operations.

## Wired events

- Project export manifest success.
- Project sharing update success.
- Standalone document deletion success.
- Account export/deletion success.
- Project export/deletion success.
- Document ZIP export and quarantine/failure path.
- Provider key save, connector create/update/delete/OAuth callback, and MFA login-preference changes.

## Required next coverage

- Account deletion, API-key create/update/delete, MCP connector create/update/delete/OAuth changes, MFA enrollment/removal, project deletion, version deletion, and failed authorization/security events.
- Request ID propagation from middleware so events can be joined to an access log without storing prompts, document content, tokens, or signed URLs.
- Retention, administrator query/export controls, alerting, and a redacted audit viewer.

This is intentionally an event foundation, not a replacement for a full tenancy/audit-retention design.
