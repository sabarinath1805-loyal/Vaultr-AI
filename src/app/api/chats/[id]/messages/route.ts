import { NextResponse } from "next/server";
import { addMessage, replaceMessages } from "@/lib/db/chats";
import { toClientMessage } from "@/lib/api/chats";
import { DatabaseUnavailableError } from "@/lib/db";
import { requireAuth, validateRequestSize, sanitizeString, isValidUUID, AuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 100000; // 100KB per message
const MAX_MESSAGES_BATCH = 500; // Max messages in a single PUT request

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = (await requireAuth(req)).userId;

    // Validate request size
    const sizeError = await validateRequestSize(req);
    if (sizeError) return sizeError;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    const text = await req.text();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (body.role !== "user" && body.role !== "assistant") {
      return NextResponse.json({ error: "Invalid message role" }, { status: 400 });
    }

    if (typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Sanitize content and validate length
    const content = sanitizeString(body.content as string, MAX_MESSAGE_LENGTH);
    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Note: Client-provided IDs are intentionally ignored - server generates UUIDs
    // to prevent ID collisions and injection attacks

    const message = addMessage(
      id,
      {
        role: body.role as "user" | "assistant",
        content,
        createdAt:
          typeof body.createdAt === "number"
            ? body.createdAt
            : typeof body.createdAt === "string"
              ? Math.floor(new Date(body.createdAt as string).getTime() / 1000)
              : undefined,
      },
      userId // Pass ownerId for ownership validation
    );

    return NextResponse.json({ message: toClientMessage(message) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats/[id]/messages POST] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = (await requireAuth(req)).userId;

    // Validate request size
    const sizeError = await validateRequestSize(req);
    if (sizeError) return sizeError;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid chat ID format" }, { status: 400 });
    }

    const putText = await req.text();
    if (!putText?.trim()) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(putText) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    // Validate batch size to prevent DoS
    if (body.messages.length > MAX_MESSAGES_BATCH) {
      return NextResponse.json(
        { error: `Too many messages. Maximum is ${MAX_MESSAGES_BATCH} per request.` },
        { status: 400 }
      );
    }

    const invalidMessage = body.messages.find(
      (message: { role?: string; content?: unknown; createdAt?: unknown }) =>
        (message.role !== "user" && message.role !== "assistant") ||
        typeof message.content !== "string" ||
        (message.createdAt !== undefined &&
          typeof message.createdAt !== "number" &&
          typeof message.createdAt !== "string")
    );

    if (invalidMessage) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    // Sanitize all message contents
    const sanitizedMessages = body.messages.map(
      (message: {
        role: "user" | "assistant";
        content: string;
        createdAt?: number | string;
      }) => ({
        role: message.role,
        content: sanitizeString(message.content, MAX_MESSAGE_LENGTH),
        createdAt:
          typeof message.createdAt === "number"
            ? message.createdAt
            : typeof message.createdAt === "string"
              ? Math.floor(new Date(message.createdAt).getTime() / 1000)
              : undefined,
      })
    );

    const messages = replaceMessages(
      id,
      sanitizedMessages,
      userId // Pass ownerId for ownership validation
    );

    return NextResponse.json({ messages: messages.map(toClientMessage) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[chats/[id]/messages PUT] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
