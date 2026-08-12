import path from "node:path";

export type ConfigIssue = {
  name: string;
  severity: "error" | "warning";
  reason: string;
};

export type RuntimeConfigReport = {
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
};

const PLACEHOLDER = /^(?:test|demo|placeholder|change[-_ ]?me|example|secret)$/i;

function present(env: NodeJS.ProcessEnv, name: string) {
  return typeof env[name] === "string" && env[name]!.trim().length > 0;
}

function addRequired(errors: ConfigIssue[], env: NodeJS.ProcessEnv, name: string, reason: string) {
  if (!present(env, name) || PLACEHOLDER.test(env[name]!.trim())) {
    errors.push({ name, severity: "error", reason });
  }
}

function addUrl(
  errors: ConfigIssue[],
  env: NodeJS.ProcessEnv,
  name: string,
  options: { https: boolean; allowLocal: boolean },
) {
  const raw = env[name]?.trim();
  if (!raw) {
    errors.push({ name, severity: "error", reason: "required URL is missing" });
    return;
  }
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (!options.allowLocal && local) throw new Error("local URL is not allowed");
    if (options.https && url.protocol !== "https:") throw new Error("HTTPS is required");
    if (url.username || url.password) throw new Error("credentials in URLs are not allowed");
  } catch (error) {
    errors.push({ name, severity: "error", reason: error instanceof Error ? error.message : "invalid URL" });
  }
}

export function validateRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfigReport {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  if (env.NODE_ENV !== "production") {
    if (env.LOG_RAW_LLM_STREAM === "true") {
      warnings.push({ name: "LOG_RAW_LLM_STREAM", severity: "warning", reason: "raw provider capture is enabled outside production" });
    }
    if (env.DOCUMENT_SCANNER_REQUIRED !== "true") {
      warnings.push({ name: "DOCUMENT_SCANNER_REQUIRED", severity: "warning", reason: "development uploads may use an explicit scanner bypass" });
    }
    return { errors, warnings };
  }

  if (env.LOG_RAW_LLM_STREAM === "true" || env.LOG_RAW_LLM_STREAM_INCLUDE_CONTENT === "true") {
    errors.push({ name: "LOG_RAW_LLM_STREAM", severity: "error", reason: "raw LLM capture is forbidden in production" });
  }
  for (const name of ["DEBUG", "MIKE_DEBUG", "DEV_AUTH_BYPASS", "ALLOW_INSECURE_AUTH", "DISABLE_AUTH"]) {
    if (env[name] === "true" || env[name] === "1") {
      errors.push({ name, severity: "error", reason: "development or auth bypass setting is enabled" });
    }
  }

  addUrl(errors, env, "SUPABASE_URL", { https: true, allowLocal: false });
  addRequired(errors, env, "SUPABASE_SECRET_KEY", "service-role backend credential is required");
  addUrl(errors, env, "FRONTEND_URL", { https: true, allowLocal: false });
  addUrl(errors, env, "API_PUBLIC_URL", { https: true, allowLocal: false });

  for (const name of ["DOWNLOAD_SIGNING_SECRET", "USER_API_KEYS_ENCRYPTION_SECRET"]) {
    addRequired(errors, env, name, "cryptographic secret is required");
    if (present(env, name) && env[name]!.trim().length < 32) {
      errors.push({ name, severity: "error", reason: "secret must be at least 32 characters" });
    }
  }
  addRequired(errors, env, "MANIFEST_SIGNING_KEY", "production export signing key is required");
  if (present(env, "MANIFEST_SIGNING_KEY") && !/^[0-9a-fA-F]{64}$/.test(env.MANIFEST_SIGNING_KEY!.trim())) {
    errors.push({ name: "MANIFEST_SIGNING_KEY", severity: "error", reason: "must be a 32-byte hex seed" });
  }

  for (const name of ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) {
    addRequired(errors, env, name, "production object storage configuration is required");
  }
  if (present(env, "R2_ENDPOINT_URL") && !env.R2_ENDPOINT_URL!.startsWith("https://")) {
    errors.push({ name: "R2_ENDPOINT_URL", severity: "error", reason: "production object storage endpoint must use HTTPS" });
  }

  if (env.DOCUMENT_SCANNER_REQUIRED !== "true") {
    errors.push({ name: "DOCUMENT_SCANNER_REQUIRED", severity: "error", reason: "production uploads must require a malware scanner" });
  }
  if (env.DOCUMENT_SCANNER_REQUIRED === "true" && !present(env, "DOCUMENT_SCANNER_BINARY")) {
    errors.push({ name: "DOCUMENT_SCANNER_BINARY", severity: "error", reason: "scanner executable is required when scanning is mandatory" });
  }
  if (present(env, "DOCUMENT_SCANNER_BINARY") && !path.isAbsolute(env.DOCUMENT_SCANNER_BINARY!.trim())) {
    errors.push({ name: "DOCUMENT_SCANNER_BINARY", severity: "error", reason: "scanner executable must be an absolute path" });
  }
  if (env.DOCUMENT_CONVERSION_SANDBOX !== "container") {
    warnings.push({ name: "DOCUMENT_CONVERSION_SANDBOX", severity: "warning", reason: "inline conversion is not a production-grade low-privilege boundary" });
  }

  return { errors, warnings };
}

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env) {
  const report = validateRuntimeConfig(env);
  if (report.errors.length > 0) {
    throw new Error(`Unsafe production configuration: ${report.errors.map((issue) => issue.name).join(", ")}`);
  }
  return report;
}
