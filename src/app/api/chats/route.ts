import { NextResponse } from "next/server";
import { createChat, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { scanContractFormData } from "@/lib/api/contract-scanner";
import { DatabaseUnavailableError } from "@/lib/db";
import { requireAuth, validateRequestSize, AuthError } from "@/lib/api-auth";
import { isValidUUID } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = (await requireAuth(req)).userId;

    const chats = listChatsWithMessages(userId).reduce<Record<string, ReturnType<typeof toClientChat>>>(
      (acc, chat) => {
        acc[chat.id] = toClientChat(chat);
        return acc;
      },
      {}
    );

    return NextResponse.json({ chats });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message, chats: {} }, { status: 503 });
    }
    console.error("[chats GET] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = (await requireAuth(req)).userId;

    // Validate request size
    const sizeError = await validateRequestSize(req);
    if (sizeError) return sizeError;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return scanContractFormData(await req.formData());
    }

    const body = await req.json().catch(() => ({}));

    // Validate ID if provided
    if (body.id !== undefined && !isValidUUID(body.id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    // Create chat with authenticated user's ID as owner
    const chat = createChat(body.id, userId);

    return NextResponse.json({ chat: toClientChat({ ...chat, messages: [] }) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats POST] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE endpoint removed for security - was unprotected mass-delete
// If admin bulk-delete is needed, it should require admin role authentication
