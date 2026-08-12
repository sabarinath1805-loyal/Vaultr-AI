import { describe, expect, it } from "vitest";
import {
  PROJECT_OPERATION_POLICY,
  WORKFLOW_OPERATION_POLICY,
  allowsProjectOperation,
  allowsWorkflowOperation,
} from "../authorizationPolicy";

describe("explicit sharing policy", () => {
  it("classifies every required project operation", () => {
    expect(Object.keys(PROJECT_OPERATION_POLICY)).toEqual(expect.arrayContaining([
      "project.rename", "project.delete", "project.share", "document.upload",
      "document.rename", "document.delete", "document.version.create",
      "document.edit.resolve", "chat.create", "chat.read", "chat.rename",
      "chat.delete", "review.create", "review.read", "review.edit",
      "review.delete", "tabular.generate", "tabular.cell.modify",
      "workflow.execute", "export", "download",
    ]));
  });

  it("never gives a shared collaborator owner-only mutations", () => {
    for (const [operation, policy] of Object.entries(PROJECT_OPERATION_POLICY)) {
      if (policy === "OWNER ONLY") {
        expect(allowsProjectOperation(operation as keyof typeof PROJECT_OPERATION_POLICY, "shared")).toBe(false);
      }
    }
    expect(allowsProjectOperation("chat.read", "shared")).toBe(true);
    expect(allowsProjectOperation("export", "shared")).toBe(true);
    expect(allowsProjectOperation("document.delete", "outsider")).toBe(false);
  });

  it("requires allow_edit for shared workflow mutation", () => {
    expect(allowsWorkflowOperation("workflow.read", "shared")).toBe(true);
    expect(allowsWorkflowOperation("workflow.execute", "shared")).toBe(true);
    expect(allowsWorkflowOperation("workflow.edit", "shared", false)).toBe(false);
    expect(allowsWorkflowOperation("workflow.edit", "shared", true)).toBe(true);
    expect(Object.keys(WORKFLOW_OPERATION_POLICY)).toHaveLength(5);
  });
});
