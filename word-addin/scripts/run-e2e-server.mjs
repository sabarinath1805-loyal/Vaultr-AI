import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptsDir, "..");

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectDir,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`E2E build exited with ${signal ?? `code ${code}`}`));
    });
  });
}

await run(process.execPath, [resolve(scriptsDir, "build-e2e.mjs")]);
await import("./serve-e2e.mjs");
