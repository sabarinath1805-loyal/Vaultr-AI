# Schema and Generated Artifact Audit

## Database source-of-truth findings

- The fresh-database snapshot is `backend/schema.sql`.
- Incremental migrations live in `backend/migrations/`; there are now 49 files, ordered from `20260419_tabular_chat_jsonb.sql` through `20260810_02_audit_events.sql`.
- There is no committed `supabase/migrations` directory. `supabase/` only contains gateway configuration.
- `backend/schema.sql` is not a complete representation of the migration history. The migration-only tables `contact_messages` and `workflow_open_source_submissions` are absent from the snapshot, despite active landing/workflow code paths and CI comments that explicitly compensate for the drift.
- The E2E workflow loads `schema.sql`, then applies every migration and suppresses migration failures as warnings. It re-grants service-role privileges and reloads PostgREST afterward. This is useful for CI recovery but is not a fail-fast drift gate.
- `scripts/e2e-local-stack.sh` similarly treats migrations as re-runnable and warns on non-zero results. `backend/scripts/test-stack.sh` loads the snapshot for a fresh stack and does not provide a complete migration-drift comparison.
- At least one migration (`20260428_workflow_shares_unique.sql`) contains conditional DDL that needs explicit rerun verification; fail-tolerant application can hide a real incompatibility.

## Generated workflow artifact

`scripts/build-workflows.js` generates `backend/src/lib/systemWorkflows.ts` and optionally a landing generated module from a sibling `mike-workflows` source tree. The source is not present in this checkout. Running `node scripts/build-workflows.js` fails with:

```text
Workflow source directory not found: mike-workflows
```

The checked-in generated TypeScript file is large and marked generated/do not edit, but its source provenance, source revision, and license clearance cannot be verified locally. No generated file was changed.

## Risks

- Fresh installs can differ depending on whether they use only `schema.sql` or the CI schema-plus-migration sequence.
- A migration-created table may lack the expected service-role grant if the post-migration grant step is omitted.
- Warning-only migration loops can produce a green setup with a partially applied schema.
- Generated workflow output can be stale or unreproducible without the external source repository.

## Required Gate 3 controls

1. Choose one canonical install path: a complete versioned snapshot or a migration-only path from an empty database.
2. Add a fail-fast disposable-database drift check that applies schema/migrations and compares tables, columns, indexes, constraints, functions, RLS flags, and grants.
3. Make every migration idempotent or record an explicit one-time migration contract; remove warning-only error handling from the gate.
4. Commit generator source revision/license metadata and run the generator in CI.
5. Add a generated-artifact freshness check.
6. Decide whether landing-only `contact_messages` is part of the application schema and keep its grants/RLS in the same source of truth.

## Gate 2 conclusion

Schema and generation are **conditional**. The mismatch is known and documented in CI, but the repository does not yet provide one independently reproducible, fail-fast database installation plus generator provenance.

## Final hardened-base schema contract

The earlier Gate 2 observations above are retained as historical findings. The
fresh-database contract is now explicit and supersedes the prior warning-only
setup path:

- `backend/schema.sql` is the canonical snapshot and contains the complete
  application shape through baseline `20260811_03_tabular_chat_provenance`.
- `backend/schema-baseline.json` explicitly inventories all 55 migration files
  represented by that snapshot and records the baseline migration checksum.
- `scripts/bootstrap-schema.mjs` requires an empty target, applies the snapshot,
  applies only migrations lexicographically newer than the baseline, records
  incremental checksums, and fails on any SQL error.
- `scripts/check-schema-bootstrap.mjs` verifies the baseline ledger, all 29
  backend-owned tables, RLS on all 29, zero direct `anon`/`authenticated` table
  grants, the provenance column/index, and the atomic OAuth claim function.
- The local stack wrapper, stack-test harness, E2E workflow, and Stack CI job
  use this same contract. A repeat bootstrap against a populated ledger is an
  intentional failure, not an idempotent repair path.

## Hardening Phase 1 update

- `node scripts/check-schema-drift.mjs` is now a fail-fast CI gate covering the 49 current migrations (48 Gate 2 migrations plus the additive audit migration), migration-created tables, and final added columns; it passes locally.
- `contact_messages`, `workflow_open_source_submissions`, and additive `audit_events` are now in the fresh schema with RLS/direct-grant hardening.
- The workflow generator now requires an exact 40-character source commit SHA. The source is absent here, so generation fails explicitly rather than using an unknown copy.

## Hardening Phase 2 evidence

- The canonical migration count is now 52: the Phase 2 additions are atomic OAuth state claiming, document processing/scan state fields, and all-backend-table RLS enablement.
- The canonical snapshot was loaded into a disposable Supabase Postgres container with `ON_ERROR_STOP=1`, both before and after the Phase 2 migrations, with no SQL errors.
- The real stack tests passed against that schema, including auth/RLS deny-all, HTTP tenant isolation, and the OAuth claim function.
- The local inventory found and closed a defense-in-depth gap: all 29 backend-owned public tables now have RLS enabled, direct `anon`/`authenticated` table grants remain zero, and service-role table grants remain explicit.
- `scripts/workflow-source.json` pins `Open-Legal-Products/mike-workflows` to `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; the source is MIT-licensed and the generated artifact contains 31 workflows.
- `scripts/check-workflow-freshness.mjs` regenerates into a temporary directory and fails on a committed-artifact mismatch. CI checks out the exact SHA before running it; the local freshness check passed.
- The source remains external and is not copied into this repository. A source fetch failure must fail CI rather than silently using an unpinned artifact.

## Overnight Foundation Completion Mission — canonical bootstrap closure

Date: 2026-08-11.

The canonical schema contract is now an empty-target snapshot bootstrap, not a
replay of the historical incremental chain:

1. Apply `backend/schema.sql` with PostgreSQL `ON_ERROR_STOP=1`.
2. Require an empty target with no existing `mike_schema_migrations` ledger or
   backend-owned tables.
3. Record baseline `20260811_03_tabular_chat_provenance` and its checksum.
4. Apply only migration files lexicographically newer than the explicit
   baseline, recording each checksum in the ledger.
5. Verify the 29 backend-owned tables, RLS, direct browser grants,
   `tabular_cells.source_document_version_ids` and its GIN index, audit events,
   and the atomic OAuth claim function.

`backend/schema-baseline.json` lists all **55** migration files represented by
the snapshot. The two empty disposable-stack runs passed; re-running against a
populated target failed closed. `npm run check:schema` also passed with **55
migrations, 15 created tables, and 49 final added columns**. Historical files
before the baseline remain useful history but are not silently replayed into
the current snapshot.
