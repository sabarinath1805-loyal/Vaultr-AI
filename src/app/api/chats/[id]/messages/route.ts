import { NextResponse } from "next/server";
import { addMessage, replaceMessages } from "@/lib/db/chats";
import { toClientMessage } from "@/lib/api/chats";

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

  const message = addMessage(params.id, {
    id: body.id,
    role: body.role,
    content: body.content,
  });

  return NextResponse.json({ message: toClientMessage(message) });
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
    (message: { role?: string; content?: unknown }) =>
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
  );

  if (invalidMessage) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const messages = replaceMessages(params.id, body.messages);

  return NextResponse.json({ messages: messages.map(toClientMessage) });
}
