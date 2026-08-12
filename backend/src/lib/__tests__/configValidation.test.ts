import { describe, expect, it } from "vitest";
import { assertProductionConfig, validateRuntimeConfig } from "../configValidation";

const base: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "s".repeat(40),
  FRONTEND_URL: "https://app.example.com",
  API_PUBLIC_URL: "https://api.example.com",
  DOWNLOAD_SIGNING_SECRET: "d".repeat(40),
  USER_API_KEYS_ENCRYPTION_SECRET: "u".repeat(40),
  MANIFEST_SIGNING_KEY: "a".repeat(64),
  R2_ENDPOINT_URL: "https://storage.example.com",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_NAME: "vaultr-documents",
  DOCUMENT_SCANNER_REQUIRED: "true",
  DOCUMENT_SCANNER_BINARY: "/usr/local/bin/approved-scanner",
};

describe("production configuration validation", () => {
  it("accepts a complete non-placeholder production configuration", () => {
    expect(assertProductionConfig(base).errors).toHaveLength(0);
  });

  it("fails closed for local URLs, raw capture, missing scanner, and demo secrets", () => {
    const report = validateRuntimeConfig({
      ...base,
      SUPABASE_URL: "http://localhost:54321",
      API_PUBLIC_URL: "http://localhost:3001",
      LOG_RAW_LLM_STREAM: "true",
      DOCUMENT_SCANNER_REQUIRED: "false",
      DOCUMENT_SCANNER_BINARY: undefined,
      DOWNLOAD_SIGNING_SECRET: "demo",
    });
    expect(report.errors.map((issue) => issue.name)).toEqual(expect.arrayContaining([
      "SUPABASE_URL", "API_PUBLIC_URL", "LOG_RAW_LLM_STREAM",
      "DOCUMENT_SCANNER_REQUIRED", "DOWNLOAD_SIGNING_SECRET",
    ]));
  });

  it("only warns about explicit raw logging outside production", () => {
    const report = validateRuntimeConfig({ NODE_ENV: "test", LOG_RAW_LLM_STREAM: "true" });
    expect(report.errors).toHaveLength(0);
    expect(report.warnings.map((issue) => issue.name)).toContain("LOG_RAW_LLM_STREAM");
  });
});
