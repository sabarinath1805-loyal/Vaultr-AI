import { describe, expect, it } from "vitest";
import process from "node:process";
import { isDocumentProcessable, scanDocumentBuffer, scanResultProcessingState } from "../documentScanning";

describe("document scanning boundary", () => {
  it("fails closed when production has no scanner", async () => {
    await expect(scanDocumentBuffer(Buffer.from("x"), "x.pdf", {
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv)).resolves.toMatchObject({ status: "unavailable" });
  });

  it("makes development bypass explicit and processable only in development", async () => {
    const result = await scanDocumentBuffer(Buffer.from("x"), "x.pdf", {
      NODE_ENV: "test",
    } as NodeJS.ProcessEnv);
    expect(result.status).toBe("bypassed");
    expect(scanResultProcessingState(result)).toBe("clean");
    expect(isDocumentProcessable(result.status, "clean")).toBe(true);
    expect(isDocumentProcessable("unavailable", "failed")).toBe(false);
  });

  it("maps scanner rejection to quarantine, never ready", () => {
    const result = { status: "quarantined" as const, provider: "scanner" };
    expect(scanResultProcessingState(result)).toBe("quarantined");
    expect(isDocumentProcessable(result.status, "quarantined")).toBe(false);
  });

  it("executes the configured scanner boundary and maps clean/quarantine/error", async () => {
    const env = {
      NODE_ENV: "production",
      DOCUMENT_SCANNER_BINARY: process.execPath,
      DOCUMENT_SCANNER_ARGS_JSON: JSON.stringify(["-e", "process.exit(0)"]),
    } as NodeJS.ProcessEnv;
    await expect(scanDocumentBuffer(Buffer.from("clean"), "x.pdf", env)).resolves.toMatchObject({
      status: "clean",
      provider: process.execPath,
    });

    env.DOCUMENT_SCANNER_ARGS_JSON = JSON.stringify(["-e", "process.exit(1)"]);
    await expect(scanDocumentBuffer(Buffer.from("quarantine"), "x.pdf", env)).resolves.toMatchObject({
      status: "quarantined",
    });

    env.DOCUMENT_SCANNER_ARGS_JSON = JSON.stringify(["-e", "process.exit(2)"]);
    await expect(scanDocumentBuffer(Buffer.from("error"), "x.pdf", env)).resolves.toMatchObject({
      status: "error",
    });
  });
});
