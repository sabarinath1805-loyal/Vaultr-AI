import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const schemaPath = path.join(root, "backend", "schema.sql");
const migrationsPath = path.join(root, "backend", "migrations");
const baselinePath = path.join(root, "backend", "schema-baseline.json");

export const BACKEND_PUBLIC_TABLES = [
  "audit_events",
  "chat_messages",
  "chats",
  "contact_messages",
  "courtlistener_citation_index",
  "courtlistener_opinion_cluster_index",
  "document_edits",
  "document_versions",
  "documents",
  "hidden_workflows",
  "library_folders",
  "project_subfolders",
  "projects",
  "tabular_cells",
  "tabular_review_chat_messages",
  "tabular_review_chats",
  "tabular_review_row_sources",
  "tabular_review_rows",
  "tabular_reviews",
  "user_api_keys",
  "user_mcp_connector_tools",
  "user_mcp_connectors",
  "user_mcp_oauth_states",
  "user_mcp_oauth_tokens",
  "user_mcp_tool_audit_logs",
  "user_profiles",
  "workflow_open_source_submissions",
  "workflow_shares",
  "workflows",
];

function fail(message) {
  throw new Error(`[schema-bootstrap] ${message}`);
}

function databaseUrlFromArgs(args) {
  const index = args.indexOf("--db-url");
  return (
    (index >= 0 ? args[index + 1] : null) ??
    process.env.SCHEMA_BOOTSTRAP_DB_URL ??
    process.env.SUPABASE_TEST_DB_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

function psqlBinary() {
  return process.env.PSQL_BIN || (process.platform === "win32" ? "psql.exe" : "psql");
}

function runPsql(databaseUrl, args, options = {}) {
  const dockerContainer = process.env.PSQL_DOCKER_CONTAINER;
  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex >= 0 ? args[fileIndex + 1] : null;
  const psqlArgs = fileIndex >= 0
    ? [...args.slice(0, fileIndex), ...args.slice(fileIndex + 2)]
    : args;
  const command = dockerContainer ? "docker" : psqlBinary();
  const commandArgs = dockerContainer
    ? [
        "exec",
        "-i",
        dockerContainer,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-X",
        ...psqlArgs,
      ]
    : [databaseUrl, "-X", ...args];
  const input = dockerContainer && filePath ? readFileSync(filePath) : undefined;
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio:
      options.capture === false
        ? [input ? "pipe" : "inherit", "inherit", "inherit"]
        : ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    fail(`could not execute ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `psql failed with exit code ${result.status}: ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result.stdout || "";
}

function query(databaseUrl, sql) {
  return runPsql(databaseUrl, ["-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql]).trim();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function loadBaseline() {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const migrationFiles = (await readdir(migrationsPath))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  if (!Array.isArray(baseline.included_migrations)) {
    fail("schema-baseline.json has no included_migrations array");
  }
  if (baseline.included_migration_count !== baseline.included_migrations.length) {
    fail("schema-baseline.json migration count does not match its explicit list");
  }
  const included = baseline.included_migrations;
  const expectedPrefix = migrationFiles.filter(
    (name) => name.localeCompare(baseline.baseline_version + ".sql") <= 0,
  );
  if (expectedPrefix.join("\n") !== included.join("\n")) {
    fail(
      "schema-baseline.json does not explicitly cover the migration files at or before its baseline marker",
    );
  }
  const latestIncluded = included[included.length - 1];
  if (latestIncluded !== `${baseline.baseline_version}.sql`) {
    fail("baseline_version is not the last explicitly included migration");
  }
  const latestChecksum = createHash("sha256")
    .update(await readFile(path.join(migrationsPath, latestIncluded)))
    .digest("hex");
  if (latestChecksum !== baseline.baseline_migration_checksum) {
    fail(`checksum mismatch for baseline migration ${latestIncluded}`);
  }
  return { baseline, migrationFiles };
}

export async function bootstrapDatabase(databaseUrl) {
  if (!databaseUrl) fail("provide --db-url or SCHEMA_BOOTSTRAP_DB_URL");
  const { baseline, migrationFiles } = await loadBaseline();

  const existing = query(
    databaseUrl,
    "select coalesce(to_regclass('public.mike_schema_migrations')::text, '')",
  );
  const existingBackendTables = Number(
    query(
      databaseUrl,
      `select count(*) from information_schema.tables where table_schema = 'public' and table_name in (${BACKEND_PUBLIC_TABLES.map(sqlLiteral).join(",")})`,
    ),
  );
  if (existing || existingBackendTables > 0) {
    fail(
      "target is not empty: the canonical bootstrap requires a new database with no Vaultr application tables or migration ledger",
    );
  }

  runPsql(databaseUrl, ["--set", "ON_ERROR_STOP=1", "--file", schemaPath], {
    capture: false,
  });

  const baselineVersion = baseline.baseline_version;
  for (const migrationFile of migrationFiles) {
    if (migrationFile.localeCompare(`${baselineVersion}.sql`) <= 0) continue;
    const migrationPath = path.join(migrationsPath, migrationFile);
    runPsql(databaseUrl, ["--set", "ON_ERROR_STOP=1", "--file", migrationPath], {
      capture: false,
    });
    const checksum = createHash("sha256")
      .update(await readFile(migrationPath))
      .digest("hex");
    query(
      databaseUrl,
      `insert into public.mike_schema_migrations(version, source, checksum) values (${sqlLiteral(
        migrationFile.slice(0, -4),
      )}, 'incremental_migration', ${sqlLiteral(checksum)}) on conflict (version) do nothing`,
    );
  }

  query(databaseUrl, "notify pgrst, 'reload schema'");
  await verifyDatabase(databaseUrl, { requireCleanLedger: true });
  return {
    baselineVersion,
    includedMigrationCount: baseline.included_migration_count,
    migrationFileCount: migrationFiles.length,
  };
}

export async function verifyDatabase(databaseUrl, options = {}) {
  if (!databaseUrl) fail("provide --db-url or SCHEMA_BOOTSTRAP_DB_URL");
  const { baseline } = await loadBaseline();
  const baselineVersion = baseline.baseline_version;
  const ledger = query(
    databaseUrl,
    "select version || E'\\t' || source || E'\\t' || coalesce(checksum, '') from public.mike_schema_migrations order by version",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  const baselineRow = ledger.find((row) => row[0] === baselineVersion);
  if (!baselineRow || baselineRow[1] !== "canonical_snapshot") {
    fail("migration ledger is missing the canonical snapshot baseline row");
  }
  if (baselineRow[2] !== baseline.baseline_migration_checksum) {
    fail("migration ledger checksum does not match schema-baseline.json");
  }
  if (options.requireCleanLedger && ledger.some((row) => row[0] < baselineVersion)) {
    fail("canonical bootstrap ledger contains a pre-baseline migration row");
  }

  const tableCount = Number(
    query(
      databaseUrl,
      `select count(*) from information_schema.tables where table_schema = 'public' and table_name in (${BACKEND_PUBLIC_TABLES.map(sqlLiteral).join(",")})`,
    ),
  );
  if (tableCount !== BACKEND_PUBLIC_TABLES.length) {
    fail(`expected ${BACKEND_PUBLIC_TABLES.length} backend tables, found ${tableCount}`);
  }

  const rlsCount = Number(
    query(
      databaseUrl,
      `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in (${BACKEND_PUBLIC_TABLES.map(sqlLiteral).join(",")}) and c.relrowsecurity`,
    ),
  );
  if (rlsCount !== BACKEND_PUBLIC_TABLES.length) {
    fail(`expected RLS on ${BACKEND_PUBLIC_TABLES.length} backend tables, found ${rlsCount}`);
  }

  const browserGrantCount = Number(
    query(
      databaseUrl,
      `select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') and table_name in (${BACKEND_PUBLIC_TABLES.map(sqlLiteral).join(",")})`,
    ),
  );
  if (browserGrantCount !== 0) {
    fail(`expected zero direct browser-role table grants, found ${browserGrantCount}`);
  }

  const provenanceColumn = query(
    databaseUrl,
    "select udt_name from information_schema.columns where table_schema = 'public' and table_name = 'tabular_cells' and column_name = 'source_document_version_ids'",
  );
  if (provenanceColumn !== "_uuid") fail("provenance column is missing or has the wrong type");
  if (query(databaseUrl, "select coalesce(to_regclass('public.idx_tabular_cells_source_versions')::text, '')") !== "idx_tabular_cells_source_versions") {
    fail("provenance GIN index is missing");
  }
  if (query(databaseUrl, "select coalesce(to_regclass('public.audit_events')::text, '')") !== "audit_events") {
    fail("audit_events table is missing");
  }
  if (
    query(
      databaseUrl,
      "select (to_regprocedure('public.claim_mcp_oauth_state(text)') is not null)::text",
    ) !== "true"
  ) {
    fail("atomic OAuth claim function is missing");
  }

  return {
    baselineVersion,
    migrationLedgerRows: ledger.length,
    tableCount,
    rlsCount,
    browserGrantCount,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  const databaseUrl = databaseUrlFromArgs(args);
  const verifyOnly = args.includes("--verify");
  const result = verifyOnly
    ? await verifyDatabase(databaseUrl)
    : await bootstrapDatabase(databaseUrl);
  console.log(JSON.stringify(result));
}
