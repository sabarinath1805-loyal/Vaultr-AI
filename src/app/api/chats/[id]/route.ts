import { NextResponse } from "next/server";
import { deleteChat, getChat, renameChat } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { DatabaseUnavailableError } from "@/lib/db";
import { requireAuth, validateRequestSize, sanitizeString, isValidUUID, AuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TITLE_LENGTH = 500;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req);
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    const chat = getChat(id, userId);

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ chat: toClientChat(chat) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats/[id] GET] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req);
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    const deleted = deleteChat(id, userId);

    if (!deleted) {
      return NextResponse.json({ error: "Chat not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats/[id] DELETE] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req);

    // Validate request size
    const sizeError = await validateRequestSize(req);
    if (sizeError) return sizeError;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    const body = await req.json();

    // Sanitize and validate title
    let title = typeof body.title === "string" ? body.title : "";
    title = sanitizeString(title, MAX_TITLE_LENGTH);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const renamed = renameChat(id, title, userId);

    if (!renamed) {
      return NextResponse.json({ error: "Chat not found or access denied" }, { status: 404 });
    }

    const chat = getChat(id, userId);
    return NextResponse.json({ chat: toClientChat(chat!) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats/[id] PATCH] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}