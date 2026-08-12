import { bootstrapDatabase } from "./schema-bootstrap.mjs";

const args = process.argv.slice(2);
const dbUrlIndex = args.indexOf("--db-url");
const databaseUrl =
  (dbUrlIndex >= 0 ? args[dbUrlIndex + 1] : undefined) ??
  process.env.SCHEMA_BOOTSTRAP_DB_URL ??
  process.env.SUPABASE_TEST_DB_URL ??
  process.env.DATABASE_URL ??
  "";

const result = await bootstrapDatabase(databaseUrl);
console.log(
  `Canonical schema bootstrap passed: baseline ${result.baselineVersion}, ${result.includedMigrationCount} migrations represented, ${result.migrationFileCount} migration files present.`,
);
