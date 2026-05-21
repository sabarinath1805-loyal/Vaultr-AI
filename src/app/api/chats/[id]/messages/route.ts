import { NextResponse } from "next/server";
import { addMessage, replaceMessages } from "@/lib/db/chats";
import { toClientMessage } from "@/lib/api/chats";
import { DatabaseUnavailableError } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  if (body.role !== "user" && body.role !== "assistant") {
    return NextResponse.json({ error: "Invalid message role" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  try {
    const message = addMessage(params.id, {
      id: body.id,
      role: body.role,
      content: body.content,
      createdAt:
        typeof body.createdAt === "number"
          ? body.createdAt
          : typeof body.createdAt === "string"
            ? Math.floor(new Date(body.createdAt).getTime() / 1000)
            : undefined,
    });

    return NextResponse.json({ message: toClientMessage(message) });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Messages are required" }, { status: 400 });
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

  try {
    const messages = replaceMessages(
      params.id,
      body.messages.map(
        (message: {
          id?: string;
          role: "user" | "assistant";
          content: string;
          createdAt?: number | string;
        }) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt:
            typeof message.createdAt === "number"
              ? message.createdAt
              : typeof message.createdAt === "string"
                ? Math.floor(new Date(message.createdAt).getTime() / 1000)
                : undefined,
        })
      )
    );

    return NextResponse.json({ messages: messages.map(toClientMessage) });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
