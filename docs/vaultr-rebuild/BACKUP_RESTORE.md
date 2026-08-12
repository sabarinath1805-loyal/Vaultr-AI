# Backup and Restore Mechanics

Date: 2026-08-10

## Database

The supported PostgreSQL evidence flow is:

1. Freeze or quiesce writes for the selected restore point.
2. Capture a custom-format `pg_dump` of the target database, record SHA-256, size, timestamp, and source project identifier in the private operations record.
3. Inspect the archive with `pg_restore --list` before using it.
4. Restore into a disposable database or isolated project with `--no-owner --exit-on-error`.
5. Run schema drift, row-count, RLS/grant, Auth login, and representative owner/shared/outsider tests against the restored target.
6. Record the restore operator, duration, failures, and cleanup of the disposable target.

The Phase 2 local proof uses the disposable Supabase Postgres container only; it is not hosted-backup or disaster-recovery sign-off.

## Phase 2 local evidence

- Custom-format dump created from the disposable Postgres 17.6 database: 430,329 bytes; SHA-256 `05250E4B5FD03491E183245C9556877376B28E03DC4AD1B7566F3AC11B514FCB`.
- `pg_restore --list` showed a valid archive with 878 TOC entries.
- Restore into a fresh disposable database succeeded with `pg_restore --no-owner --exit-on-error` under the local Supabase administrative role; restored `projects=0`, `documents=0` row-count checks passed.
- The disposable restore databases and container archive were removed after verification. This proves local mechanics only; hosted backup retention, R2 object restore, and recovery objectives remain open.

## Object storage

R2/S3 backup and restore must cover source objects, converted PDFs, versioned objects, metadata, and lifecycle/version-delete markers. The application derives paths from document/version IDs, so restore validation must compare database metadata to object inventory and identify orphans. A database-only restore is not sufficient.

## Rollback

Before a hosted schema or identity cutover, record a named owner, restore point, DNS/manifest rollback action, secret-rotation plan, and user communication path. Do not delete the source environment until login, MFA, document access, export, storage, and Word add-in smoke checks pass on the target.

## Unresolved production decisions

- Hosted backup provider, encryption key owner, retention, residency, and restore authorization.
- R2 versioning/object-lock/lifecycle configuration and deletion-of-backup semantics.
- Recovery point/recovery time objectives and the incident escalation owner.
