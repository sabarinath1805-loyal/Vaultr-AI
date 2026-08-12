import { describe, expect, it } from "vitest";
import { buildUserAccountExport } from "../userDataExport";

type Row = Record<string, any>;

function databaseFor(tables: Record<string, Row[]>) {
    return {
        from(table: string) {
            let columns = "*";
            const predicates: ((row: Row) => boolean)[] = [];
            let rangeStart = 0;
            let rangeEnd = Number.MAX_SAFE_INTEGER;
            const query: Record<string, any> = {};

            query.select = (nextColumns = "*") => {
                columns = nextColumns;
                return query;
            };
            query.eq = (column: string, value: unknown) => {
                predicates.push((row) => row[column] === value);
                return query;
            };
            query.neq = (column: string, value: unknown) => {
                predicates.push((row) => row[column] !== value);
                return query;
            };
            query.is = (column: string, value: unknown) => {
                predicates.push((row) =>
                    value === null ? row[column] == null : row[column] === value,
                );
                return query;
            };
            query.in = (column: string, values: unknown[]) => {
                const allowed = new Set(values);
                predicates.push((row) => allowed.has(row[column]));
                return query;
            };
            query.filter = (column: string, operator: string, value: string) => {
                if (operator === "cs") {
                    const expected = JSON.parse(value) as unknown[];
                    predicates.push((row) =>
                        Array.isArray(row[column]) &&
                        expected.every((item) => row[column].includes(item)),
                    );
                }
                return query;
            };
            query.order = () => query;
            query.range = (from: number, to: number) => {
                rangeStart = from;
                rangeEnd = to;
                return query;
            };
            query.then = (
                resolve: (value: unknown) => unknown,
                reject?: (reason: unknown) => unknown,
            ) =>
                Promise.resolve()
                    .then(() => {
                        const filtered = (tables[table] ?? [])
                            .filter((row) => predicates.every((predicate) => predicate(row)))
                            .slice(rangeStart, rangeEnd + 1);
                        const data =
                            columns === "*"
                                ? filtered
                                : filtered.map((row) =>
                                      Object.fromEntries(
                                          columns
                                              .split(",")
                                              .map((column) => column.trim())
                                              .filter(Boolean)
                                              .map((column) => [column, row[column]]),
                                      ),
                                  );
                        return { data, error: null };
                    })
                    .then(resolve, reject);
            return query;
        },
    } as any;
}

function version(
    id: string,
    processing_state: string,
    overrides: Row = {},
) {
    return {
        id,
        document_id: "d1",
        processing_state,
        deleted_at: null,
        ...overrides,
    };
}

describe("account export Tabular provenance", () => {
    it("labels every source state and withholds foreign version metadata/content", async () => {
        const db = databaseFor({
            user_profiles: [{ user_id: "u1", email: "u1@test.local" }],
            tabular_reviews: [
                { id: "review-1", user_id: "u1", created_at: "2026-08-11" },
            ],
            tabular_review_rows: [
                {
                    id: "row-1",
                    review_id: "review-1",
                    document_id: "d1",
                    source_document_ids: ["d1"],
                },
            ],
            documents: [
                {
                    id: "d1",
                    user_id: "u1",
                    project_id: null,
                    current_version_id: "v-current",
                },
            ],
            document_versions: [
                version("v-current", "ready"),
                version("v-stale", "ready"),
                version("v-pending", "pending_scan"),
                version("v-processing", "processing"),
                version("v-failed", "failed"),
                version("v-quarantined", "quarantined"),
                version("v-deleted", "ready", {
                    deleted_at: "2026-08-11T00:00:00.000Z",
                }),
                version("v-foreign", "ready", { document_id: "d2" }),
            ],
            tabular_cells: [
                { id: "c-trusted", review_id: "review-1", row_id: "row-1", content: "trusted", source_document_version_ids: ["v-current"] },
                { id: "c-stale", review_id: "review-1", row_id: "row-1", content: "stale", source_document_version_ids: ["v-stale"] },
                { id: "c-pending", review_id: "review-1", row_id: "row-1", content: "pending", source_document_version_ids: ["v-pending"] },
                { id: "c-processing", review_id: "review-1", row_id: "row-1", content: "processing", source_document_version_ids: ["v-processing"] },
                { id: "c-failed", review_id: "review-1", row_id: "row-1", content: "failed", source_document_version_ids: ["v-failed"] },
                { id: "c-quarantined", review_id: "review-1", row_id: "row-1", content: "quarantined", source_document_version_ids: ["v-quarantined"] },
                { id: "c-deleted", review_id: "review-1", row_id: "row-1", content: "deleted", source_document_version_ids: ["v-deleted"] },
                { id: "c-legacy", review_id: "review-1", row_id: "row-1", content: "legacy" },
                { id: "c-malformed", review_id: "review-1", row_id: "row-1", content: "malformed", source_document_version_ids: "not-an-array" },
                { id: "c-foreign", review_id: "review-1", row_id: "row-1", content: "User B source content", source_document_version_ids: ["v-foreign"] },
            ],
        });

        const result = await buildUserAccountExport(
            db,
            "u1",
            "u1@test.local",
        );
        const cells = new Map(
            result.tabular_cells.map((cell: Row) => [cell.id, cell]),
        );

        expect(cells.get("c-trusted")?.provenance_status).toBe("trusted");
        expect(cells.get("c-stale")?.provenance_status).toBe("stale");
        expect(cells.get("c-pending")?.provenance_status).toBe("pending");
        expect(cells.get("c-processing")?.provenance_status).toBe("processing");
        expect(cells.get("c-failed")?.provenance_status).toBe("failed");
        expect(cells.get("c-quarantined")?.provenance_status).toBe("quarantined");
        expect(cells.get("c-deleted")?.provenance_status).toBe("deleted");
        expect(cells.get("c-legacy")?.provenance_status).toBe("unverified");
        expect(cells.get("c-malformed")?.provenance_status).toBe("unverified");

        expect(cells.get("c-foreign")).toMatchObject({
            provenance_status: "unverified",
            content: null,
            source_document_version_ids: null,
        });
        expect(
            JSON.stringify(result),
        ).not.toContain("User B source content");
        expect(result.document_versions.map((row: Row) => row.id)).not.toContain(
            "v-foreign",
        );
    });

    it("fails closed across the complete serialized provenance matrix", async () => {
        const db = databaseFor({
            user_profiles: [{ user_id: "u1", email: "u1@test.local" }],
            tabular_reviews: [
                { id: "review-1", user_id: "u1", created_at: "2026-08-11" },
            ],
            tabular_review_rows: [
                {
                    id: "row-owned",
                    review_id: "review-1",
                    document_id: "d1",
                    source_document_ids: ["d1"],
                },
                {
                    id: "row-foreign",
                    review_id: "review-1",
                    document_id: "d2",
                    source_document_ids: ["d2"],
                },
                {
                    id: "row-missing-document",
                    review_id: "review-1",
                    document_id: "d-missing",
                    source_document_ids: ["d-missing"],
                },
            ],
            documents: [
                {
                    id: "d1",
                    user_id: "u1",
                    project_id: null,
                    current_version_id: "v-owned-trusted",
                },
                {
                    id: "d2",
                    user_id: "u2",
                    project_id: null,
                    current_version_id: "v-foreign-trusted",
                },
            ],
            document_versions: [
                version("v-owned-trusted", "ready"),
                version("v-owned-stale", "ready"),
                version("v-owned-pending", "pending_scan"),
                version("v-owned-processing", "processing"),
                version("v-owned-failed", "failed"),
                version("v-owned-quarantined", "quarantined"),
                version("v-owned-deleted", "ready", {
                    deleted_at: "2026-08-11T00:00:00.000Z",
                }),
                version("v-foreign-trusted", "ready", { document_id: "d2" }),
                version("v-foreign-pending", "pending_scan", { document_id: "d2" }),
                version("v-foreign-failed", "failed", { document_id: "d2" }),
                version("v-foreign-quarantined", "quarantined", { document_id: "d2" }),
            ],
            tabular_cells: [
                { id: "owned-trusted", review_id: "review-1", row_id: "row-owned", content: "owned trusted", source_document_version_ids: ["v-owned-trusted"] },
                { id: "owned-stale", review_id: "review-1", row_id: "row-owned", content: "owned stale", source_document_version_ids: ["v-owned-stale"] },
                { id: "owned-pending", review_id: "review-1", row_id: "row-owned", content: "owned pending", source_document_version_ids: ["v-owned-pending"] },
                { id: "owned-processing", review_id: "review-1", row_id: "row-owned", content: "owned processing", source_document_version_ids: ["v-owned-processing"] },
                { id: "owned-failed", review_id: "review-1", row_id: "row-owned", content: "owned failed", source_document_version_ids: ["v-owned-failed"] },
                { id: "owned-quarantined", review_id: "review-1", row_id: "row-owned", content: "owned quarantined", source_document_version_ids: ["v-owned-quarantined"] },
                { id: "owned-deleted", review_id: "review-1", row_id: "row-owned", content: "owned deleted", source_document_version_ids: ["v-owned-deleted"] },
                { id: "missing-provenance", review_id: "review-1", row_id: "row-owned", content: "legacy historical text" },
                { id: "malformed-provenance", review_id: "review-1", row_id: "row-owned", content: "malformed historical text", source_document_version_ids: "not-an-array" },
                { id: "duplicate-provenance", review_id: "review-1", row_id: "row-owned", content: "duplicate historical text", source_document_version_ids: ["v-owned-trusted", "v-owned-trusted"] },
                { id: "wrong-document", review_id: "review-1", row_id: "row-owned", content: "wrong document sentinel", source_document_version_ids: ["v-foreign-trusted"] },
                { id: "foreign-trusted", review_id: "review-1", row_id: "row-foreign", content: "FOREIGN TRUSTED SENTINEL", source_document_version_ids: ["v-foreign-trusted"] },
                { id: "foreign-pending", review_id: "review-1", row_id: "row-foreign", content: "FOREIGN PENDING SENTINEL", source_document_version_ids: ["v-foreign-pending"] },
                { id: "foreign-failed", review_id: "review-1", row_id: "row-foreign", content: "FOREIGN FAILED SENTINEL", source_document_version_ids: ["v-foreign-failed"] },
                { id: "foreign-quarantined", review_id: "review-1", row_id: "row-foreign", content: "FOREIGN QUARANTINED SENTINEL", source_document_version_ids: ["v-foreign-quarantined"] },
                { id: "inaccessible-version", review_id: "review-1", row_id: "row-owned", content: "INACCESSIBLE VERSION SENTINEL", source_document_version_ids: ["v-not-exported"] },
                { id: "mixed-owned-foreign", review_id: "review-1", row_id: "row-owned", content: "MIXED FOREIGN SENTINEL", source_document_version_ids: ["v-owned-trusted", "v-foreign-trusted"] },
                { id: "mixed-trusted-invalid", review_id: "review-1", row_id: "row-owned", content: "MIXED INVALID SENTINEL", source_document_version_ids: ["v-owned-trusted", "v-not-exported"] },
                { id: "source-not-in-exported-rows", review_id: "review-1", row_id: "row-missing-document", content: "MISSING SOURCE SENTINEL", source_document_version_ids: ["v-not-exported"] },
                { id: "malicious-substitution", review_id: "review-1", row_id: "row-owned", content: "MALICIOUS FOREIGN UUID SENTINEL", source_document_version_ids: ["v-foreign-trusted"] },
            ],
        });

        const result = await buildUserAccountExport(db, "u1", "u1@test.local");
        const cells = new Map(
            result.tabular_cells.map((cell: Row) => [cell.id, cell]),
        );
        const expectedUnverified = [
            "missing-provenance",
            "malformed-provenance",
            "duplicate-provenance",
            "wrong-document",
            "foreign-trusted",
            "foreign-pending",
            "foreign-failed",
            "foreign-quarantined",
            "inaccessible-version",
            "mixed-owned-foreign",
            "mixed-trusted-invalid",
            "source-not-in-exported-rows",
            "malicious-substitution",
        ];

        for (const id of expectedUnverified) {
            expect(cells.get(id)?.provenance_status).toBe("unverified");
            expect(cells.get(id)?.provenance_status).not.toBe("trusted");
        }

        for (const id of [
            "foreign-trusted",
            "foreign-pending",
            "foreign-failed",
            "foreign-quarantined",
            "inaccessible-version",
            "mixed-owned-foreign",
            "mixed-trusted-invalid",
            "source-not-in-exported-rows",
            "malicious-substitution",
        ]) {
            expect(cells.get(id)?.content).toBeNull();
            expect(cells.get(id)?.source_document_version_ids).toBeNull();
        }

        expect(cells.get("owned-trusted")?.provenance_status).toBe("trusted");
        expect(cells.get("owned-stale")?.provenance_status).toBe("stale");
        expect(cells.get("owned-pending")?.provenance_status).toBe("pending");
        expect(cells.get("owned-processing")?.provenance_status).toBe("processing");
        expect(cells.get("owned-failed")?.provenance_status).toBe("failed");
        expect(cells.get("owned-quarantined")?.provenance_status).toBe("quarantined");
        expect(cells.get("owned-deleted")?.provenance_status).toBe("deleted");

        const serialized = JSON.stringify(result);
        for (const sentinel of [
            "FOREIGN TRUSTED SENTINEL",
            "FOREIGN PENDING SENTINEL",
            "FOREIGN FAILED SENTINEL",
            "FOREIGN QUARANTINED SENTINEL",
            "INACCESSIBLE VERSION SENTINEL",
            "MIXED FOREIGN SENTINEL",
            "MIXED INVALID SENTINEL",
            "MISSING SOURCE SENTINEL",
            "MALICIOUS FOREIGN UUID SENTINEL",
        ]) {
            expect(serialized).not.toContain(sentinel);
        }
        expect(result.document_versions.map((row: Row) => row.id)).not.toContain(
            "v-foreign-trusted",
        );
    });
});
