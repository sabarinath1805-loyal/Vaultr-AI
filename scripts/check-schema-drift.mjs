import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "backend", "schema.sql");
const migrationsPath = path.join(root, "backend", "migrations");
const schema = await readFile(schemaPath, "utf8");
const migrationFiles = (await readdir(migrationsPath))
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const invalidNames = migrationFiles.filter((name) => !/^\d{8}(?:_[0-9]+)?_[a-z0-9][a-z0-9_-]*\.sql$/i.test(name));
if (invalidNames.length > 0) {
  throw new Error(`Migration filenames must be date-prefixed: ${invalidNames.join(", ")}`);
}

const migrationText = await Promise.all(
  migrationFiles.map(async (name) => ({ name, text: await readFile(path.join(migrationsPath, name), "utf8") })),
);

function unquote(identifier) {
  return identifier.replace(/^"|"$/g, "").toLowerCase();
}

const migrationTables = new Set();
for (const migration of migrationText) {
  for (const match of migration.text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(["\w]+)/gi)) {
    migrationTables.add(unquote(match[1]));
  }
}
const schemaTables = new Set(
  [...schema.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(["\w]+)/gi)].map((match) => unquote(match[1])),
);
// These two columns were introduced by the first BYO-key migration and then
// superseded by the encrypted user_api_keys table. They are intentionally not
// part of the canonical fresh schema; keep this allowlist explicit so a new
// unrepresented migration column still fails the gate.
const intentionallyRetiredColumns = new Set([
  "user_profiles.claude_api_key",
  "user_profiles.gemini_api_key",
]);
const missingTables = [...migrationTables].filter((table) => !schemaTables.has(table));
if (missingTables.length > 0) {
  throw new Error(`Canonical schema is missing migration-created tables: ${missingTables.join(", ")}`);
}

const finalAddedColumns = new Map();
function addColumn(table, column) {
  const normalizedTable = unquote(table);
  const normalizedColumn = unquote(column);
  const columns = finalAddedColumns.get(normalizedTable) ?? new Set();
  columns.add(normalizedColumn);
  finalAddedColumns.set(normalizedTable, columns);
}
function dropColumn(table, column) {
  finalAddedColumns.get(unquote(table))?.delete(unquote(column));
}

for (const migration of migrationText) {
  for (const statement of migration.text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(["\w]+)([\s\S]*?);/gi)) {
    const table = statement[1];
    const body = statement[2];
    for (const match of body.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?(["\w]+)/gi)) addColumn(table, match[1]);
    for (const match of body.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?(["\w]+)/gi)) dropColumn(table, match[1]);
  }
}

const missingColumns = [];
for (const [table, columns] of finalAddedColumns) {
  const tableMatch = schema.match(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\);`, "i"));
  if (!tableMatch) continue;
  for (const column of columns) {
    if (intentionallyRetiredColumns.has(`${table}.${column}`)) continue;
    const columnRe = new RegExp(`^\\s*${column}\\s+`, "im");
    const alterColumnRe = new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${table}[\\s\\S]*?add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${column}\\b`,
      "i",
    );
    if (!columnRe.test(tableMatch[1]) && !alterColumnRe.test(schema)) {
      missingColumns.push(`${table}.${column}`);
    }
  }
}
if (missingColumns.length > 0) {
  throw new Error(`Canonical schema is missing migration-added columns: ${missingColumns.join(", ")}`);
}

console.log(`Schema drift check passed: ${migrationFiles.length} migrations, ${migrationTables.size} created tables, ${[...finalAddedColumns.values()].reduce((n, columns) => n + columns.size, 0)} final added columns.`);
