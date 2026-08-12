/**
 * Explicit sharing policy for the current Mike-based application.
 *
 * Route code still performs the resource/linkage checks because a policy
 * label cannot prove that a caller reached the intended parent. This module
 * is the single classification source used by tests and authorization docs.
 */

export type SharingPolicy =
  | "OWNER ONLY"
  | "OWNER + SHARED WRITE"
  | "OWNER + SHARED READ"
  | "NO SHARED ACCESS";

export type ProjectOperation =
  | "project.rename"
  | "project.delete"
  | "project.share"
  | "document.upload"
  | "document.rename"
  | "document.delete"
  | "document.version.create"
  | "document.edit.resolve"
  | "chat.create"
  | "chat.read"
  | "chat.rename"
  | "chat.delete"
  | "review.create"
  | "review.read"
  | "review.edit"
  | "review.delete"
  | "tabular.generate"
  | "tabular.cell.modify"
  | "workflow.execute"
  | "export"
  | "download";

export const PROJECT_OPERATION_POLICY: Record<ProjectOperation, SharingPolicy> = {
  "project.rename": "OWNER ONLY",
  "project.delete": "OWNER ONLY",
  "project.share": "OWNER ONLY",
  "document.upload": "OWNER ONLY",
  "document.rename": "OWNER ONLY",
  "document.delete": "OWNER ONLY",
  "document.version.create": "OWNER ONLY",
  "document.edit.resolve": "OWNER ONLY",
  "chat.create": "OWNER + SHARED WRITE",
  "chat.read": "OWNER + SHARED READ",
  "chat.rename": "OWNER ONLY",
  "chat.delete": "OWNER ONLY",
  "review.create": "OWNER ONLY",
  "review.read": "OWNER + SHARED READ",
  "review.edit": "OWNER ONLY",
  "review.delete": "OWNER ONLY",
  "tabular.generate": "OWNER ONLY",
  "tabular.cell.modify": "OWNER ONLY",
  "workflow.execute": "OWNER + SHARED READ",
  export: "OWNER + SHARED READ",
  download: "OWNER + SHARED READ",
};

export type WorkflowOperation = "workflow.read" | "workflow.execute" | "workflow.edit" | "workflow.share" | "workflow.delete";

export const WORKFLOW_OPERATION_POLICY: Record<WorkflowOperation, SharingPolicy> = {
  "workflow.read": "OWNER + SHARED READ",
  "workflow.execute": "OWNER + SHARED READ",
  "workflow.edit": "OWNER + SHARED WRITE",
  "workflow.share": "OWNER ONLY",
  "workflow.delete": "OWNER ONLY",
};

export function allowsSharedProjectOperation(operation: ProjectOperation) {
  const policy = PROJECT_OPERATION_POLICY[operation];
  return policy === "OWNER + SHARED READ" || policy === "OWNER + SHARED WRITE";
}

export function allowsProjectOperation(
  operation: ProjectOperation,
  role: "owner" | "shared" | "outsider",
) {
  if (role === "outsider" || PROJECT_OPERATION_POLICY[operation] === "NO SHARED ACCESS") return false;
  if (role === "owner") return true;
  return allowsSharedProjectOperation(operation);
}

export function allowsWorkflowOperation(
  operation: WorkflowOperation,
  role: "owner" | "shared" | "outsider",
  sharedAllowEdit = false,
) {
  if (role === "outsider") return false;
  if (role === "owner") return true;
  const policy = WORKFLOW_OPERATION_POLICY[operation];
  return policy === "OWNER + SHARED READ" ||
    (policy === "OWNER + SHARED WRITE" && sharedAllowEdit);
}
