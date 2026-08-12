import type { createServerSupabase } from "./supabase";
import { isDocumentVersionTrusted } from "./documentVersionSecurity";

type Supa = ReturnType<typeof createServerSupabase>;

export type TabularProvenanceState =
  | "trusted"
  | "stale"
  | "unverified"
  | "pending"
  | "processing"
  | "failed"
  | "quarantined"
  | "deleted";

export type TabularReviewRowForProvenance = {
  id: string;
  document_id?: string | null;
  source_document_ids?: string[];
};

export type TabularCellForProvenance = {
  id: string;
  row_id: string;
  source_document_version_ids?: unknown;
};

export type TabularCellProvenance = {
  state: TabularProvenanceState;
  sourceDocumentVersionIds: string[];
};

type DocumentRow = {
  id: string;
  current_version_id: string | null;
};

type VersionRow = {
  id: string;
  document_id: string;
  processing_state: unknown;
  deleted_at?: string | null;
};

/**
 * Parse persisted source-version provenance without coercing malformed or
 * legacy values into trust. A cell must contain a non-empty, duplicate-free
 * array of version IDs before it can be considered for trusted use.
 */
export function parseSourceDocumentVersionIds(
  value: unknown,
): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (
    value.some(
      (id) => typeof id !== "string" || id.trim().length === 0,
    )
  ) {
    return null;
  }
  const ids = value.map((id) => (id as string).trim());
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

export function sourceDocumentVersionIdsForPersistence(
  ids: string[],
): string[] | null {
  const parsed = parseSourceDocumentVersionIds(ids);
  return parsed;
}

function expectedSourceDocumentIds(row: TabularReviewRowForProvenance) {
  const ids = row.source_document_ids?.length
    ? row.source_document_ids
    : row.document_id
      ? [row.document_id]
      : [];
  return [
    ...new Set(
      ids.filter((id): id is string => !!id && id.trim().length > 0),
    ),
  ];
}

function sameSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

/**
 * Classify one cell from already-loaded database rows. A trusted result means
 * the cell's exact version set is the document's current version set and all
 * those versions remain trusted. Older-but-still-trusted output is stale so
 * it cannot masquerade as output for a newer active version.
 */
export function classifyTabularCellProvenance(params: {
  row: TabularReviewRowForProvenance | undefined;
  sourceDocumentVersionIds: unknown;
  documents: DocumentRow[];
  versions: VersionRow[];
}): TabularCellProvenance {
  const { row } = params;
  const sourceDocumentVersionIds = parseSourceDocumentVersionIds(
    params.sourceDocumentVersionIds,
  );
  if (!row || !sourceDocumentVersionIds) {
    return { state: "unverified", sourceDocumentVersionIds: [] };
  }

  const expectedDocumentIds = expectedSourceDocumentIds(row);
  if (expectedDocumentIds.length === 0) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  const documentsById = new Map(params.documents.map((doc) => [doc.id, doc]));
  const expectedDocuments = expectedDocumentIds.map((id) =>
    documentsById.get(id),
  );
  if (expectedDocuments.some((doc) => !doc)) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  const versionsById = new Map(params.versions.map((version) => [version.id, version]));
  const sourceVersions = sourceDocumentVersionIds.map((id) =>
    versionsById.get(id),
  );
  if (sourceVersions.some((version) => !version)) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  if (
    sourceVersions.some(
      (version) => !version || !expectedDocumentIds.includes(version.document_id),
    )
  ) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  const currentVersionIds = expectedDocuments.map(
    (document) => document!.current_version_id,
  );
  if (currentVersionIds.some((id) => typeof id !== "string" || !id)) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  const sourceVersionsMatchDocuments =
    sourceVersions.length === expectedDocumentIds.length &&
    new Set(sourceVersions.map((version) => version!.document_id)).size ===
      expectedDocumentIds.length;

  if (!sourceVersionsMatchDocuments) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  // Preserve the concrete trust failure in exports and audit responses. A
  // generic "stale" label was sufficient for redaction, but it hid whether a
  // consumer was looking at pending, failed, quarantined, or deleted source
  // material. These states are checked before the active-version comparison so
  // a deleted/pending historical version is still described accurately.
  if (sourceVersions.some((version) => !!version?.deleted_at)) {
    return { state: "deleted", sourceDocumentVersionIds };
  }
  if (
    sourceVersions.some(
      (version) => classifySourceVersionState(version?.processing_state) === "quarantined",
    )
  ) {
    return { state: "quarantined", sourceDocumentVersionIds };
  }
  if (
    sourceVersions.some(
      (version) => classifySourceVersionState(version?.processing_state) === "failed",
    )
  ) {
    return { state: "failed", sourceDocumentVersionIds };
  }
  if (
    sourceVersions.some(
      (version) => classifySourceVersionState(version?.processing_state) === "pending",
    )
  ) {
    return { state: "pending", sourceDocumentVersionIds };
  }
  if (
    sourceVersions.some(
      (version) => classifySourceVersionState(version?.processing_state) === "processing",
    )
  ) {
    return { state: "processing", sourceDocumentVersionIds };
  }
  if (
    sourceVersions.some(
      (version) => classifySourceVersionState(version?.processing_state) === "unknown",
    )
  ) {
    return { state: "unverified", sourceDocumentVersionIds };
  }

  if (!sameSet(sourceDocumentVersionIds, currentVersionIds as string[])) {
    return { state: "stale", sourceDocumentVersionIds };
  }

  return {
    state: "trusted",
    sourceDocumentVersionIds,
  };
}

function classifySourceVersionState(state: unknown):
  | "pending"
  | "processing"
  | "failed"
  | "quarantined"
  | "trusted"
  | "unknown" {
  if (state === "uploaded" || state === "pending_scan") return "pending";
  if (state === "processing") return "processing";
  if (state === "failed") return "failed";
  if (state === "quarantined") return "quarantined";
  if (isDocumentVersionTrusted(state)) return "trusted";
  return "unknown";
}

async function loadSourceVersionRows(
  db: Supa,
  expectedDocumentIds: string[],
  sourceDocumentVersionIds: string[],
) {
  if (expectedDocumentIds.length === 0 || sourceDocumentVersionIds.length === 0) {
    return { documents: [] as DocumentRow[], versions: [] as VersionRow[] };
  }

  const [documentsResult, versionsResult] = await Promise.all([
    db
      .from("documents")
      .select("id, current_version_id")
      .in("id", expectedDocumentIds),
    db
      .from("document_versions")
      .select("id, document_id, processing_state, deleted_at")
      .in("id", sourceDocumentVersionIds),
  ]);
  if (documentsResult.error) throw new Error(documentsResult.error.message);
  if (versionsResult.error) throw new Error(versionsResult.error.message);
  return {
    documents: (documentsResult.data ?? []) as DocumentRow[],
    versions: (versionsResult.data ?? []) as VersionRow[],
  };
}

/** Validate a source snapshot immediately before persisting or consuming it. */
export async function classifyCurrentTabularSourceVersions(
  db: Supa,
  expectedDocumentIds: string[],
  sourceDocumentVersionIds: string[],
): Promise<TabularProvenanceState> {
  const sourceIds = parseSourceDocumentVersionIds(sourceDocumentVersionIds);
  if (!sourceIds) return "unverified";
  const rows = await loadSourceVersionRows(
    db,
    [...new Set(expectedDocumentIds)],
    sourceIds,
  );
  return classifyTabularCellProvenance({
    row: {
      id: "source-snapshot",
      source_document_ids: [...new Set(expectedDocumentIds)],
    },
    sourceDocumentVersionIds: sourceIds,
    documents: rows.documents,
    versions: rows.versions,
  }).state;
}

/**
 * Load cell provenance for a review. Legacy cells with no provenance are
 * deliberately returned as unverified; callers must not expose their content
 * to model/tool consumers or treat it as current UI output.
 */
export async function loadTabularCellProvenance(
  db: Supa,
  rows: TabularReviewRowForProvenance[],
  cells: TabularCellForProvenance[],
): Promise<Map<string, TabularCellProvenance>> {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const result = new Map<string, TabularCellProvenance>();
  const sourceIdsByCell = new Map<string, string[]>();
  const documentIds = new Set<string>();
  const versionIds = new Set<string>();

  for (const cell of cells) {
    const sourceIds = parseSourceDocumentVersionIds(
      cell.source_document_version_ids,
    );
    if (!sourceIds) {
      result.set(cell.id, {
        state: "unverified",
        sourceDocumentVersionIds: [],
      });
      continue;
    }
    const row = rowById.get(cell.row_id);
    const expectedIds = row ? expectedSourceDocumentIds(row) : [];
    sourceIdsByCell.set(cell.id, sourceIds);
    for (const id of expectedIds) documentIds.add(id);
    for (const id of sourceIds) versionIds.add(id);
  }

  if (sourceIdsByCell.size === 0) return result;

  const loaded = await loadSourceVersionRows(
    db,
    [...documentIds],
    [...versionIds],
  );
  for (const cell of cells) {
    if (result.has(cell.id)) continue;
    const row = rowById.get(cell.row_id);
    result.set(
      cell.id,
      classifyTabularCellProvenance({
        row,
        sourceDocumentVersionIds: sourceIdsByCell.get(cell.id),
        documents: loaded.documents,
        versions: loaded.versions,
      }),
    );
  }
  return result;
}
