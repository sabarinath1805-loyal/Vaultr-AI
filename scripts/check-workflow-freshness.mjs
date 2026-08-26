import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "scripts/workflow-source.json"), "utf8"));
const source = path.resolve(process.env.VAULTR_WORKFLOWS_DIR ?? path.resolve(root, config.path));
if (!fs.existsSync(source)) {
  throw new Error(`Workflow source directory not found: ${source}`);
}
const approvedRef = process.env.VAULTR_WORKFLOWS_REF ?? config.ref;
if (!/^[0-9a-f]{40}$/i.test(approvedRef ?? "")) {
  throw new Error("Workflow source is not pinned to an exact commit SHA");
}

const output = fs.mkdtempSync(path.join(os.tmpdir(), "vaultr-workflow-freshness-"));
try {
  execFileSync(process.execPath, [path.join(root, "scripts/build-workflows.js")], {
    cwd: root,
    env: { ...process.env, VAULTR_WORKFLOWS_DIR: source, VAULTR_WORKFLOWS_REF: approvedRef, VAULTR_WORKFLOWS_OUTPUT_DIR: output },
    stdio: "inherit",
  });
  const generated = path.join(output, "backend/src/lib/systemWorkflows.ts");
  const committed = path.join(root, "backend/src/lib/systemWorkflows.ts");
  if (!fs.existsSync(generated) || !fs.existsSync(committed)) {
    throw new Error("Generated workflow artifact is missing");
  }
  if (!Buffer.from(fs.readFileSync(generated)).equals(Buffer.from(fs.readFileSync(committed)))) {
    throw new Error("Generated workflow artifact is stale; run npm run build:workflows with the approved source");
  }
  console.log(`Workflow freshness passed at ${approvedRef}.`);
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
