import type { createServerSupabase } from "./supabase";
import { isDocumentVersionTrusted } from "./documentVersionSecurity";
import { parseSourceDocumentVersionIds } from "./tabularProvenance";
import type { ChatMessage } from "./chat/types";

type Supa = ReturnType<typeof createServerSupabase>;

export const TABULAR_CHAT_PROVENANCE_VERSION = 1 as const;

export type TabularChatMessageProvenance =
  | {
      version: typeof TABULAR_CHAT_PROVENANCE_VERSION;
      kind: "plain";
    }
  | {
      version: typeof TABULAR_CHAT_PROVENANCE_VERSION;
      kind: "tabular_derived";
      source_document_version_ids: string[];
    };

export type PersistedTabularChatMessage = {
  role: unknown;
  content: unknown;
  provenance?: unknown;
};

export const UNSAFE_TABULAR_HISTORY_MESSAGE =
  "[Previous Tabular output omitted because its source is no longer trusted. Regenerate the current review data before relying on it.]";

export function plainTabularChatProvenance(): TabularChatMessageProvenance {
  return {
    version: TABULAR_CHAT_PROVENANCE_VERSION,
    kind: "plain",
  };
}

export function derivedTabularChatProvenance(
  sourceDocumentVersionIds: string[],
): TabularChatMessageProvenance {
  return {
    version: TABULAR_CHAT_PROVENANCE_VERSION,
    kind: "tabular_derived",
    source_document_version_ids: [...sourceDocumentVersionIds],
  };
}

export function parseTabularChatProvenance(
  value: unknown,
): TabularChatMessageProvenance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (row.version !== TABULAR_CHAT_PROVENANCE_VERSION) return null;
  if (row.kind === "plain") return plainTabularChatProvenance();
  if (row.kind !== "tabular_derived") return null;
  const ids = parseSourceDocumentVersionIds(
    row.source_document_version_ids,
  );
  if (!ids) return null;
  return derivedTabularChatProvenance(ids);
}

export function tabularAssistantContentToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .filter(
      (event): event is { type: "content"; text: string } =>
        !!event &&
        typeof event === "object" &&
        !Array.isArray(event) &&
        (event as { type?: unknown }).type === "content" &&
        typeof (event as { text?: unknown }).text === "string",
    )
    .map((event) => event.text)
    .join("");
}

/**
 * Validate only server-persisted Tabular provenance. The allowed document IDs
 * come from the already-authorized review rows; a caller never supplies them
 * to this function. Every recorded version must still be the current,
 * non-deleted, trusted version of one of those documents.
 */
export async function isTrustedTabularChatProvenance(
  db: Supa,
  allowedDocumentIds: string[],
  provenance: TabularChatMessageProvenance | null,
): Promise<boolean> {
  if (!provenance || provenance.kind !== "tabular_derived") {
    return provenance?.kind === "plain";
  }

  const sourceIds = parseSourceDocumentVersionIds(
    provenance.source_document_version_ids,
  );
  const documentIds = [
    ...new Set(
      allowedDocumentIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  ];
  if (!sourceIds || documentIds.length === 0) return false;

  const [documentsResult, versionsResult] = await Promise.all([
    db
      .from("documents")
      .select("id, current_version_id")
      .in("id", documentIds),
    db
      .from("document_versions")
      .select("id, document_id, processing_state, deleted_at")
      .in("id", sourceIds),
  ]);
  if (documentsResult.error) throw new Error(documentsResult.error.message);
  if (versionsResult.error) throw new Error(versionsResult.error.message);

  const documents = (documentsResult.data ?? []) as {
    id: string;
    current_version_id: string | null;
  }[];
  const versions = (versionsResult.data ?? []) as {
    id: string;
    document_id: string;
    processing_state: unknown;
    deleted_at?: string | null;
  }[];
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const versionsById = new Map(versions.map((version) => [version.id, version]));
  const allowedIds = new Set(documentIds);

  if (documents.length !== allowedIds.size || versions.length !== sourceIds.length) {
    return false;
  }

  return sourceIds.every((sourceId) => {
    const version = versionsById.get(sourceId);
    const document = version ? documentsById.get(version.document_id) : null;
    return (
      !!version &&
      !!document &&
      allowedIds.has(version.document_id) &&
      !version.deleted_at &&
      isDocumentVersionTrusted(version.processing_state) &&
      document.current_version_id === version.id
    );
  });
}

/**
 * Convert only database-owned history into model messages. User-authored
 * messages remain ordinary conversation turns. Assistant messages without
 * valid server provenance are replaced with a neutral boundary marker; their
 * original text is never returned to the model.
 */
export async function loadTrustedTabularChatHistory(
  db: Supa,
  rows: PersistedTabularChatMessage[],
  allowedDocumentIds: string[],
): Promise<ChatMessage[]> {
  const history: ChatMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      if (typeof row.content === "string") {
        history.push({ role: "user", content: row.content });
      }
      continue;
    }
    if (row.role !== "assistant") continue;

    const provenance = parseTabularChatProvenance(row.provenance);
    const trusted = await isTrustedTabularChatProvenance(
      db,
      allowedDocumentIds,
      provenance,
    );
    history.push({
      role: "assistant",
      content: trusted
        ? tabularAssistantContentToText(row.content)
        : UNSAFE_TABULAR_HISTORY_MESSAGE,
    });
  }
  return history;
}
