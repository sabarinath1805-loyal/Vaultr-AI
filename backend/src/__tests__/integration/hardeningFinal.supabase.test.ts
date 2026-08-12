import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import {
    derivedTabularChatProvenance,
    loadTrustedTabularChatHistory,
    UNSAFE_TABULAR_HISTORY_MESSAGE,
} from "../../lib/tabularChatHistory";
import {
    isDocumentPromotionConflict,
    promoteDocumentVersion,
} from "../../lib/documentPromotion";
import { buildUserAccountExport } from "../../lib/userDataExport";

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const maybeDescribe = url && serviceKey ? describe : describe.skip;

maybeDescribe("final hardening real Supabase boundary", () => {
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const emailA = `hardening-owner-${suffix}@test.local`;
    const emailB = `hardening-foreign-${suffix}@test.local`;
    let admin: SupabaseClient;
    let userA = "";
    let userB = "";
    let tokenA = "";
    let documentA = "";
    let documentB = "";
    let versionA1 = "";
    let versionA2 = "";
    let versionA3 = "";
    let versionB = "";
    let versionBPending = "";
    let versionBFailed = "";
    let versionBQuarantined = "";
    let reviewId = "";
    let rowId = "";
    let foreignRowId = "";
    let chatId = "";

    beforeAll(async () => {
        admin = createClient(url!, serviceKey!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const createdA = await admin.auth.admin.createUser({
            email: emailA,
            password: "HardeningTest1!",
            email_confirm: true,
        });
        const createdB = await admin.auth.admin.createUser({
            email: emailB,
            password: "HardeningTest1!",
            email_confirm: true,
        });
        if (createdA.error || !createdA.data.user) throw createdA.error;
        if (createdB.error || !createdB.data.user) throw createdB.error;
        userA = createdA.data.user.id;
        userB = createdB.data.user.id;

        if (anonKey) {
            const client = createClient(url!, anonKey, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const signedIn = await client.auth.signInWithPassword({
                email: emailA,
                password: "HardeningTest1!",
            });
            if (signedIn.error || !signedIn.data.session) {
                throw signedIn.error ?? new Error("owner sign-in failed");
            }
            tokenA = signedIn.data.session.access_token;
        }

        const documents = await admin
            .from("documents")
            .insert([
                { user_id: userA, status: "ready" },
                { user_id: userB, status: "ready" },
            ])
            .select("id, user_id");
        if (documents.error || !documents.data || documents.data.length !== 2) {
            throw documents.error ?? new Error("document seed failed");
        }
        documentA = documents.data.find((row) => row.user_id === userA)!.id;
        documentB = documents.data.find((row) => row.user_id === userB)!.id;

        const versions = await admin
            .from("document_versions")
            .insert([
                {
                    document_id: documentA,
                    source: "upload",
                    version_number: 1,
                    filename: "owned-v1.pdf",
                    processing_state: "ready",
                },
                {
                    document_id: documentA,
                    source: "user_upload",
                    version_number: 2,
                    filename: "owned-v2.pdf",
                    processing_state: "ready",
                },
                {
                    document_id: documentA,
                    source: "assistant_edit",
                    version_number: 3,
                    filename: "owned-v3.pdf",
                    processing_state: "ready",
                },
                {
                    document_id: documentB,
                    source: "upload",
                    version_number: 1,
                    filename: "foreign.pdf",
                    processing_state: "ready",
                },
                {
                    document_id: documentB,
                    source: "user_upload",
                    version_number: 2,
                    filename: "foreign-pending.pdf",
                    processing_state: "pending_scan",
                },
                {
                    document_id: documentB,
                    source: "user_upload",
                    version_number: 3,
                    filename: "foreign-failed.pdf",
                    processing_state: "failed",
                },
                {
                    document_id: documentB,
                    source: "user_upload",
                    version_number: 4,
                    filename: "foreign-quarantined.pdf",
                    processing_state: "quarantined",
                },
            ])
            .select("id, document_id, version_number");
        if (versions.error || !versions.data || versions.data.length !== 7) {
            throw versions.error ?? new Error("version seed failed");
        }
        versionA1 = versions.data.find(
            (row) => row.document_id === documentA && row.version_number === 1,
        )!.id;
        versionA2 = versions.data.find(
            (row) => row.document_id === documentA && row.version_number === 2,
        )!.id;
        versionA3 = versions.data.find(
            (row) => row.document_id === documentA && row.version_number === 3,
        )!.id;
        versionB = versions.data.find((row) => row.document_id === documentB)!.id;
        versionBPending = versions.data.find(
            (row) => row.document_id === documentB && row.version_number === 2,
        )!.id;
        versionBFailed = versions.data.find(
            (row) => row.document_id === documentB && row.version_number === 3,
        )!.id;
        versionBQuarantined = versions.data.find(
            (row) => row.document_id === documentB && row.version_number === 4,
        )!.id;
        const pointer = await admin
            .from("documents")
            .update({ current_version_id: versionA2 })
            .eq("id", documentA);
        if (pointer.error) throw pointer.error;
        const foreignPointer = await admin
            .from("documents")
            .update({ current_version_id: versionB })
            .eq("id", documentB);
        if (foreignPointer.error) throw foreignPointer.error;

        const review = await admin
            .from("tabular_reviews")
            .insert({
                user_id: userA,
                title: "Hardening review",
                document_ids: [documentA],
                columns_config: [{ index: 0, name: "Summary", prompt: "summary" }],
            })
            .select("id")
            .single();
        if (review.error || !review.data) throw review.error;
        reviewId = review.data.id;

        const row = await admin
            .from("tabular_review_rows")
            .insert({
                review_id: reviewId,
                label: "Owned document",
                row_type: "document",
                document_id: documentA,
                sort_index: 0,
            })
            .select("id")
            .single();
        if (row.error || !row.data) throw row.error;
        rowId = row.data.id;

        const foreignRow = await admin
            .from("tabular_review_rows")
            .insert({
                review_id: reviewId,
                label: "Foreign source injection",
                row_type: "document",
                document_id: documentB,
                sort_index: 1,
            })
            .select("id")
            .single();
        if (foreignRow.error || !foreignRow.data) throw foreignRow.error;
        foreignRowId = foreignRow.data.id;

        const cells = await admin.from("tabular_cells").insert([
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 0,
                content: JSON.stringify({ summary: "current owned result" }),
                status: "done",
                source_document_version_ids: [versionA2],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 1,
                content: JSON.stringify({ summary: "old owned result" }),
                status: "done",
                source_document_version_ids: [versionA1],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 2,
                content: JSON.stringify({ summary: "foreign source content" }),
                status: "done",
                source_document_version_ids: [versionB],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 3,
                content: JSON.stringify({ summary: "missing provenance" }),
                status: "done",
                source_document_version_ids: null,
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 4,
                content: JSON.stringify({ summary: "malformed provenance" }),
                status: "done",
                source_document_version_ids: [],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 5,
                content: JSON.stringify({ summary: "duplicate provenance" }),
                status: "done",
                source_document_version_ids: [versionA2, versionA2],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 6,
                content: JSON.stringify({ summary: "unresolved source sentinel" }),
                status: "done",
                source_document_version_ids: [randomUUID()],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 7,
                content: JSON.stringify({ summary: "mixed foreign sentinel" }),
                status: "done",
                source_document_version_ids: [versionA2, versionB],
            },
            {
                review_id: reviewId,
                row_id: rowId,
                document_id: documentA,
                column_index: 8,
                content: JSON.stringify({ summary: "mixed invalid sentinel" }),
                status: "done",
                source_document_version_ids: [versionA2, randomUUID()],
            },
            {
                review_id: reviewId,
                row_id: foreignRowId,
                document_id: documentB,
                column_index: 0,
                content: JSON.stringify({ summary: "FOREIGN TRUSTED SENTINEL" }),
                status: "done",
                source_document_version_ids: [versionB],
            },
            {
                review_id: reviewId,
                row_id: foreignRowId,
                document_id: documentB,
                column_index: 1,
                content: JSON.stringify({ summary: "FOREIGN PENDING SENTINEL" }),
                status: "done",
                source_document_version_ids: [versionBPending],
            },
            {
                review_id: reviewId,
                row_id: foreignRowId,
                document_id: documentB,
                column_index: 2,
                content: JSON.stringify({ summary: "FOREIGN FAILED SENTINEL" }),
                status: "done",
                source_document_version_ids: [versionBFailed],
            },
            {
                review_id: reviewId,
                row_id: foreignRowId,
                document_id: documentB,
                column_index: 3,
                content: JSON.stringify({ summary: "FOREIGN QUARANTINED SENTINEL" }),
                status: "done",
                source_document_version_ids: [versionBQuarantined],
            },
        ]);
        if (cells.error) throw cells.error;

        const chat = await admin
            .from("tabular_review_chats")
            .insert({ review_id: reviewId, user_id: userA, title: "History" })
            .select("id")
            .single();
        if (chat.error || !chat.data) throw chat.error;
        chatId = chat.data.id;
        const message = await admin.from("tabular_review_chat_messages").insert({
            chat_id: chatId,
            role: "assistant",
            content: [{ type: "content", text: "stale chat output" }],
            provenance: derivedTabularChatProvenance([versionA1]),
        });
        if (message.error) throw message.error;
    });

    afterAll(async () => {
        if (reviewId) await admin.from("tabular_reviews").delete().eq("id", reviewId);
        if (documentA) await admin.from("documents").delete().eq("id", documentA);
        if (documentB) await admin.from("documents").delete().eq("id", documentB);
        if (userA) await admin.auth.admin.deleteUser(userA);
        if (userB) await admin.auth.admin.deleteUser(userB);
    });

    it("rejects stale server-persisted Tabular chat output after the active pointer changes", async () => {
        const stored = await admin
            .from("tabular_review_chat_messages")
            .select("role, content, provenance")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true });
        expect(stored.error).toBeNull();

        const history = await loadTrustedTabularChatHistory(
            admin as any,
            stored.data ?? [],
            [documentA],
        );
        expect(history[0]?.content).toBe(UNSAFE_TABULAR_HISTORY_MESSAGE);
        expect(JSON.stringify(history)).not.toContain("stale chat output");
    });

    it("labels account-export provenance and redacts a foreign source payload", async () => {
        const account = await buildUserAccountExport(
            admin as any,
            userA,
            emailA,
        );
        const cells = new Map(
            account.tabular_cells.map((cell: { id: string }) => [cell.id, cell]),
        );
        const statuses = account.tabular_cells.map(
            (cell: { provenance_status: string }) => cell.provenance_status,
        );
        expect(statuses).toContain("trusted");
        expect(statuses).toContain("stale");
        expect(statuses).toContain("unverified");
        const foreignCells = [...cells.values()].filter(
            (cell: any) => cell.row_id === foreignRowId,
        );
        expect(foreignCells).toHaveLength(4);
        for (const foreign of foreignCells) {
            expect(foreign).toMatchObject({
                content: null,
                source_document_version_ids: null,
                provenance_status: "unverified",
            });
            expect(foreign.provenance_status).not.toBe("trusted");
        }
        expect(JSON.stringify(account)).not.toContain("FOREIGN TRUSTED SENTINEL");
        expect(JSON.stringify(account)).not.toContain("FOREIGN PENDING SENTINEL");
        expect(JSON.stringify(account)).not.toContain("FOREIGN FAILED SENTINEL");
        expect(JSON.stringify(account)).not.toContain("FOREIGN QUARANTINED SENTINEL");
        expect(account.document_versions.map((row: { id: string }) => row.id)).not.toContain(
            versionB,
        );
    });

    const exportRouteIt = anonKey ? it : it.skip;
    exportRouteIt("enforces the same provenance boundary through GET /user/export", async () => {
        const response = await request(app)
            .get("/user/export")
            .set("Authorization", `Bearer ${tokenA}`);
        expect(response.status).toBe(200);

        const serialized = JSON.stringify(response.body);
        expect(serialized).not.toContain("FOREIGN TRUSTED SENTINEL");
        expect(serialized).not.toContain("FOREIGN PENDING SENTINEL");
        expect(serialized).not.toContain("FOREIGN FAILED SENTINEL");
        expect(serialized).not.toContain("FOREIGN QUARANTINED SENTINEL");
        expect(response.body.document_versions.map((row: { id: string }) => row.id)).not.toContain(
            versionB,
        );

        const foreignCells = response.body.tabular_cells.filter(
            (cell: { row_id: string }) => cell.row_id === foreignRowId,
        );
        expect(foreignCells).toHaveLength(4);
        for (const foreign of foreignCells) {
            expect(foreign).toMatchObject({
                content: null,
                source_document_version_ids: null,
                provenance_status: "unverified",
            });
            expect(foreign.provenance_status).not.toBe("trusted");
        }

        const invalidCells = response.body.tabular_cells.filter(
            (cell: { row_id: string; column_index: number }) =>
                cell.row_id === rowId && cell.column_index >= 3,
        );
        expect(invalidCells.map((cell: { provenance_status: string }) => cell.provenance_status)).toEqual(
            expect.arrayContaining(["unverified"]),
        );
    });

    it("promotes once with CAS and preserves the winner on a stale retry", async () => {
        const first = await promoteDocumentVersion({
            db: admin as any,
            documentId: documentA,
            candidateVersionId: versionA3,
            expectedCurrentVersionId: versionA2,
        });
        expect(first.current_version_id).toBe(versionA3);

        await expect(
            promoteDocumentVersion({
                db: admin as any,
                documentId: documentA,
                candidateVersionId: versionA1,
                expectedCurrentVersionId: versionA2,
            }),
        ).rejects.toSatisfy((error: unknown) => {
            expect(isDocumentPromotionConflict(error)).toBe(true);
            return true;
        });

        const pointer = await admin
            .from("documents")
            .select("current_version_id")
            .eq("id", documentA)
            .single();
        expect(pointer.data?.current_version_id).toBe(versionA3);
    });
});
