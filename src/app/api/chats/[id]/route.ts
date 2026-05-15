import { NextResponse } from "next/server";
import { deleteChat, getChat, renameChat } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const chat = getChat(params.id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ chat: toClientChat(chat) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  deleteChat(params.id);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  renameChat(params.id, title);
  const chat = getChat(params.id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ chat: toClientChat(chat) });
}
