import type { createServerSupabase } from "./supabase";
import { isDocumentVersionTrusted } from "./documentVersionSecurity";

type Supa = ReturnType<typeof createServerSupabase>;

export type DocumentPromotionPatch = Record<string, unknown>;

export class DocumentPromotionError extends Error {
  readonly code:
    | "invalid_candidate"
    | "conflict"
    | "database_error";

  constructor(
    code: DocumentPromotionError["code"],
    message: string,
  ) {
    super(message);
    this.name = "DocumentPromotionError";
    this.code = code;
  }
}

export function isDocumentPromotionConflict(error: unknown): boolean {
  return (
    error instanceof DocumentPromotionError && error.code === "conflict"
  );
}

/**
 * Atomically promote one ready, non-deleted version if the document still has
 * the caller's expected current pointer. The candidate validation is done on
 * the server, and the conditional UPDATE's affected row is checked. A stale
 * request therefore returns a conflict instead of silently moving the active
 * pointer backwards.
 */
export async function promoteDocumentVersion(params: {
  db: Supa;
  documentId: string;
  candidateVersionId: string | null;
  expectedCurrentVersionId: string | null;
  patch?: DocumentPromotionPatch;
}) {
  const {
    db,
    documentId,
    candidateVersionId,
    expectedCurrentVersionId,
    patch = {},
  } = params;

  if (candidateVersionId) {
    const { data: candidate, error: candidateError } = await db
      .from("document_versions")
      .select("id, document_id, processing_state, deleted_at")
      .eq("id", candidateVersionId)
      .maybeSingle();
    if (candidateError) {
      throw new DocumentPromotionError(
        "database_error",
        `Failed to validate document version: ${candidateError.message}`,
      );
    }
    if (
      !candidate ||
      candidate.id !== candidateVersionId ||
      candidate.document_id !== documentId ||
      candidate.deleted_at ||
      !isDocumentVersionTrusted(candidate.processing_state)
    ) {
      throw new DocumentPromotionError(
        "invalid_candidate",
        "Document version is not eligible for promotion.",
      );
    }
  }

  let update = db
    .from("documents")
    .update({
      ...patch,
      current_version_id: candidateVersionId,
    })
    .eq("id", documentId);
  update =
    expectedCurrentVersionId === null
      ? update.is("current_version_id", null)
      : update.eq("current_version_id", expectedCurrentVersionId);

  const { data: promoted, error: promotionError } = await update
    .select("id, current_version_id")
    .maybeSingle();
  if (promotionError) {
    throw new DocumentPromotionError(
      "database_error",
      `Failed to promote document version: ${promotionError.message}`,
    );
  }
  if (!promoted) {
    throw new DocumentPromotionError(
      "conflict",
      "Document version promotion conflicted with a newer active version.",
    );
  }
  return promoted as { id: string; current_version_id: string | null };
}
