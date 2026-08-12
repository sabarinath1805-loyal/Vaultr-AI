# Enterprise and Operational Gaps

Gate 2 audits the current repository baseline; the following gaps are not authorized implementation work in this execution.

## Identity and administration

- No admin role, organization role model, tenant boundary, or admin route was found.
- No SSO/SAML/OIDC enterprise configuration, SCIM provisioning, domain verification, or enforced organization membership was found.
- MFA exists for selected sensitive actions, but there is no enterprise policy/step-up audit model.
- Workflow open-source submissions have a reviewer-queue table but no reviewer/admin authorization surface.

## Governance and data lifecycle

- No documented retention/deletion schedule, legal hold, eDiscovery, litigation hold, or customer-configurable data region.
- No malware scanning/quarantine, DLP/classification policy, sensitive-content detection, or tenant-level export approval.
- Backups, restore drills, RPO/RTO, disaster recovery, and cross-region failure behavior are not represented in the repository.
- No formal subprocessors/provider retention inventory or customer DPA controls are encoded.

## Security operations

- No centralized structured audit event stream with immutable retention and access review was found.
- No Sentry/OpenTelemetry/metrics/tracing integration was found in the inspected tree.
- Raw LLM debugging can write sensitive payloads without repository-defined retention controls.
- No uniform provider timeout, cost quota, abuse throttle, or model allowlist is evident across all outbound LLM paths.
- No parser sandbox or child-process resource policy is evident for LibreOffice and document extraction.

## Authorization and storage

- Service-role queries bypass RLS, making distributed route checks the effective object boundary.
- Shared collaborator mutation semantics are not consistently declared or tested.
- Schema snapshot and migration history are not a single fail-fast source of truth.
- Object cleanup is best effort in several failure paths; orphan detection and deletion verification are not documented.
- Signed URL and HMAC download artifacts need an explicit privacy/expiry policy.

## Commercial and support readiness

- No billing/subscription/seat/entitlement control was found in the current baseline.
- No SLA, status page, support escalation, incident runbook, customer audit export, or security questionnaire package is present.
- License/provenance differs from historical Vaultr and requires legal clearance before any reuse or parity claim.

## Priority

P0 before any production/enterprise claim: service-role authorization matrix completion, real RLS/stack tests, dependency triage, parser isolation, and schema/generator reproducibility.<br>
P1 before a controlled pilot: organization/role model, audit logging/retention, provider governance, malware/quarantine, backup/restore evidence, and shared-write policy.<br>
P2 after pilot: SSO/SCIM, DLP/legal hold, commercial entitlements, SLA/support packaging, and historical parity decisions.
