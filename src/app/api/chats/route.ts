import { NextResponse } from "next/server";
import { createChat, deleteAllChats, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { scanContractFormData } from "@/lib/api/contract-scanner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const chats = listChatsWithMessages().reduce<Record<string, ReturnType<typeof toClientChat>>>(
    (acc, chat) => {
      acc[chat.id] = toClientChat(chat);
      return acc;
    },
    {}
  );

  return NextResponse.json({ chats });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return scanContractFormData(await req.formData());
  }

  const body = await req.json().catch(() => ({}));
  const chat = createChat(body.id);

  return NextResponse.json({ chat: toClientChat({ ...chat, messages: [] }) });
}

export async function DELETE() {
  deleteAllChats();

  return NextResponse.json({ ok: true });
}
