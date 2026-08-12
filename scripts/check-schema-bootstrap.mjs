import { verifyDatabase } from "./schema-bootstrap.mjs";

const args = process.argv.slice(2);
const dbUrlIndex = args.indexOf("--db-url");
const databaseUrl =
  (dbUrlIndex >= 0 ? args[dbUrlIndex + 1] : undefined) ??
  process.env.SCHEMA_BOOTSTRAP_DB_URL ??
  process.env.SUPABASE_TEST_DB_URL ??
  process.env.DATABASE_URL ??
  "";

const result = await verifyDatabase(databaseUrl);
console.log(
  `Canonical schema verification passed: baseline ${result.baselineVersion}, ${result.tableCount}/${result.rlsCount} tables RLS-enabled, ${result.browserGrantCount} direct browser grants, ${result.migrationLedgerRows} ledger row(s).`,
);
