import { describe, expect, it } from "vitest";
import {
    derivedTabularChatProvenance,
    isTrustedTabularChatProvenance,
    loadTrustedTabularChatHistory,
    plainTabularChatProvenance,
    UNSAFE_TABULAR_HISTORY_MESSAGE,
} from "../tabularChatHistory";

function databaseFor(params: {
    documents?: unknown[];
    versions?: unknown[];
    documentError?: { message: string } | null;
    versionError?: { message: string } | null;
}) {
    return {
        from(table: string) {
            const data = table === "documents" ? params.documents ?? [] : params.versions ?? [];
            const error =
                table === "documents"
                    ? params.documentError ?? null
                    : params.versionError ?? null;
            const query: Record<string, unknown> = {};
            query.select = () => query;
            query.in = () => query;
            query.then = (
                resolve: (value: unknown) => unknown,
                reject?: (reason: unknown) => unknown,
            ) => Promise.resolve({ data, error }).then(resolve, reject);
            return query;
        },
    } as any;
}

describe("Tabular chat history provenance boundary", () => {
    it("keeps ordinary user turns and trusted plain assistant turns", async () => {
        const history = await loadTrustedTabularChatHistory(
            databaseFor({}),
            [
                { role: "user", content: "What is the renewal term?" },
                {
                    role: "assistant",
                    content: [{ type: "content", text: "Twelve months." }],
                    provenance: plainTabularChatProvenance(),
                },
            ],
            [],
        );

        expect(history).toEqual([
            { role: "user", content: "What is the renewal term?" },
            { role: "assistant", content: "Twelve months." },
        ]);
    });

    it.each([
        ["missing provenance", undefined],
        ["malformed provenance", { version: 1, kind: "tabular_derived" }],
        [
            "duplicate source IDs",
            {
                version: 1,
                kind: "tabular_derived",
                source_document_version_ids: ["v1", "v1"],
            },
        ],
        [
            "wrong document",
            derivedTabularChatProvenance(["outsider-version"]),
        ],
    ])("replaces %s assistant output with a neutral marker", async (_name, provenance) => {
        const history = await loadTrustedTabularChatHistory(
            databaseFor({
                documents: [{ id: "doc-1", current_version_id: "v1" }],
                versions: [
                    {
                        id: "outsider-version",
                        document_id: "doc-outsider",
                        processing_state: "ready",
                        deleted_at: null,
                    },
                ],
            }),
            [
                {
                    role: "assistant",
                    content: [{ type: "content", text: "untrusted output" }],
                    provenance,
                },
            ],
            ["doc-1"],
        );

        expect(history).toEqual([
            { role: "assistant", content: UNSAFE_TABULAR_HISTORY_MESSAGE },
        ]);
        expect(JSON.stringify(history)).not.toContain("untrusted output");
    });

    it.each(["pending_scan", "processing", "failed", "quarantined"])(
        "blocks a derived turn while its source is %s",
        async (processing_state) => {
            const history = await loadTrustedTabularChatHistory(
                databaseFor({
                    documents: [{ id: "doc-1", current_version_id: "v1" }],
                    versions: [
                        {
                            id: "v1",
                            document_id: "doc-1",
                            processing_state,
                            deleted_at: null,
                        },
                    ],
                }),
                [
                    {
                        role: "assistant",
                        content: [{ type: "content", text: "old result" }],
                        provenance: derivedTabularChatProvenance(["v1"]),
                    },
                ],
                ["doc-1"],
            );

            expect(history[0]?.content).toBe(UNSAFE_TABULAR_HISTORY_MESSAGE);
        },
    );

    it("blocks a previously trusted derived turn when the active pointer changes", async () => {
        const db = databaseFor({
            documents: [{ id: "doc-1", current_version_id: "v2" }],
            versions: [
                {
                    id: "v1",
                    document_id: "doc-1",
                    processing_state: "ready",
                    deleted_at: null,
                },
                {
                    id: "v2",
                    document_id: "doc-1",
                    processing_state: "ready",
                    deleted_at: null,
                },
            ],
        });
        const history = await loadTrustedTabularChatHistory(
            db,
            [
                {
                    role: "assistant",
                    content: [{ type: "content", text: "old result" }],
                    provenance: derivedTabularChatProvenance(["v1"]),
                },
            ],
            ["doc-1"],
        );

        expect(history[0]?.content).toBe(UNSAFE_TABULAR_HISTORY_MESSAGE);
        expect(
            await isTrustedTabularChatProvenance(
                db,
                ["doc-1"],
                derivedTabularChatProvenance(["v1"]),
            ),
        ).toBe(false);
    });

    it("rejects an outsider version even when the caller supplies its UUID", async () => {
        const result = await isTrustedTabularChatProvenance(
            databaseFor({
                documents: [{ id: "doc-1", current_version_id: "v1" }],
                versions: [
                    {
                        id: "outsider-version",
                        document_id: "doc-2",
                        processing_state: "ready",
                        deleted_at: null,
                    },
                ],
            }),
            ["doc-1"],
            derivedTabularChatProvenance(["outsider-version"]),
        );

        expect(result).toBe(false);
    });
});
