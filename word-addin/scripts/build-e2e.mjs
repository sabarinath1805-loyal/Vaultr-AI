import { spawn } from "node:child_process";

const env = {
  ...process.env,
  REACT_APP_API_BASE_URL: "http://localhost:3001",
  REACT_APP_SUPABASE_URL: "http://localhost:54321",
  REACT_APP_SUPABASE_ANON_KEY: "test-anon-key",
  REACT_APP_WEB_APP_URL: "http://localhost:3000",
  REACT_APP_DEFAULT_MODEL: "claude-sonnet-4-6",
};

const isWindows = process.platform === "win32";
const command = isWindows ? "cmd.exe" : "webpack";
const args = isWindows
  ? ["/d", "/s", "/c", "webpack --mode production"]
  : ["--mode", "production"];
const child = spawn(command, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`Unable to start webpack: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`webpack exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
