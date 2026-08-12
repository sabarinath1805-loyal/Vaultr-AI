import { describe, expect, it } from "vitest";
import {
    DocumentPromotionError,
    isDocumentPromotionConflict,
    promoteDocumentVersion,
} from "../documentPromotion";

type PromotionState = {
    currentVersionId: string | null;
    candidates: Record<string, Record<string, unknown>>;
    updates: Record<string, unknown>[];
};

function databaseFor(state: PromotionState) {
    return {
        from(table: string) {
            const query: Record<string, any> = {};
            let payload: Record<string, unknown> = {};
            let expected: string | null | undefined;

            query.select = () => query;
            query.eq = (_column: string, value: string) => {
                if (table === "documents" && _column === "current_version_id") {
                    expected = value;
                }
                return query;
            };
            query.is = (_column: string, value: null) => {
                if (table === "documents" && _column === "current_version_id") {
                    expected = value;
                }
                return query;
            };
            query.update = (nextPayload: Record<string, unknown>) => {
                payload = nextPayload;
                return query;
            };
            query.maybeSingle = async () => {
                if (table === "document_versions") {
                    const candidateId = Object.keys(state.candidates).find(
                        (id) => id === (query.__candidateId as string),
                    );
                    return {
                        data: candidateId
                            ? state.candidates[candidateId]
                            : null,
                        error: null,
                    };
                }

                if (
                    expected === state.currentVersionId &&
                    typeof payload.current_version_id !== "undefined"
                ) {
                    state.currentVersionId = payload.current_version_id as string | null;
                    state.updates.push(payload);
                    return {
                        data: {
                            id: "doc-1",
                            current_version_id: state.currentVersionId,
                        },
                        error: null,
                    };
                }
                return { data: null, error: null };
            };
            if (table === "document_versions") {
                query.__candidateId = "v2";
                query.eq = (_column: string, value: string) => {
                    query.__candidateId = value;
                    return query;
                };
            }
            return query;
        },
    } as any;
}

function candidate(
    id: string,
    overrides: Record<string, unknown> = {},
) {
    return {
        id,
        document_id: "doc-1",
        processing_state: "ready",
        deleted_at: null,
        ...overrides,
    };
}

describe("document active-version compare-and-swap", () => {
    it("promotes a trusted candidate when the expected pointer still matches", async () => {
        const state: PromotionState = {
            currentVersionId: "v1",
            candidates: { v2: candidate("v2") },
            updates: [],
        };

        const result = await promoteDocumentVersion({
            db: databaseFor(state),
            documentId: "doc-1",
            candidateVersionId: "v2",
            expectedCurrentVersionId: "v1",
        });

        expect(result.current_version_id).toBe("v2");
        expect(state.currentVersionId).toBe("v2");
        expect(state.updates).toHaveLength(1);
    });

    it("does not overwrite a newer winner when a stale promotion retries", async () => {
        const state: PromotionState = {
            currentVersionId: "v1",
            candidates: { v2: candidate("v2"), v3: candidate("v3") },
            updates: [],
        };
        const db = databaseFor(state);

        await promoteDocumentVersion({
            db,
            documentId: "doc-1",
            candidateVersionId: "v2",
            expectedCurrentVersionId: "v1",
        });

        await expect(
            promoteDocumentVersion({
                db,
                documentId: "doc-1",
                candidateVersionId: "v3",
                expectedCurrentVersionId: "v1",
            }),
        ).rejects.toSatisfy((error: unknown) => {
            expect(isDocumentPromotionConflict(error)).toBe(true);
            return true;
        });

        expect(state.currentVersionId).toBe("v2");
        expect(state.updates).toHaveLength(1);
    });

    it.each([
        ["wrong document", { document_id: "doc-2" }],
        ["pending candidate", { processing_state: "pending_scan" }],
        ["quarantined candidate", { processing_state: "quarantined" }],
        ["deleted candidate", { deleted_at: "2026-08-11T00:00:00.000Z" }],
    ])("rejects an %s before touching the pointer", async (_name, overrides) => {
        const state: PromotionState = {
            currentVersionId: "v1",
            candidates: { v2: candidate("v2", overrides) },
            updates: [],
        };

        await expect(
            promoteDocumentVersion({
                db: databaseFor(state),
                documentId: "doc-1",
                candidateVersionId: "v2",
                expectedCurrentVersionId: "v1",
            }),
        ).rejects.toMatchObject({
            code: "invalid_candidate",
        } satisfies Partial<DocumentPromotionError>);
        expect(state.currentVersionId).toBe("v1");
        expect(state.updates).toHaveLength(0);
    });

    it("supports an initial null pointer without allowing a later null-expected retry", async () => {
        const state: PromotionState = {
            currentVersionId: null,
            candidates: { v1: candidate("v1"), v2: candidate("v2") },
            updates: [],
        };
        const db = databaseFor(state);

        await promoteDocumentVersion({
            db,
            documentId: "doc-1",
            candidateVersionId: "v1",
            expectedCurrentVersionId: null,
        });
        expect(state.currentVersionId).toBe("v1");

        await expect(
            promoteDocumentVersion({
                db,
                documentId: "doc-1",
                candidateVersionId: "v2",
                expectedCurrentVersionId: null,
            }),
        ).rejects.toThrow("promotion conflicted");
        expect(state.currentVersionId).toBe("v1");
    });
});
