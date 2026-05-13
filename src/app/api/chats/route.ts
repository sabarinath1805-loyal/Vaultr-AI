import { NextResponse } from "next/server";
import { createChat, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";

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
  const body = await req.json().catch(() => ({}));
  const chat = createChat(body.id);

  return NextResponse.json({ chat: toClientChat({ ...chat, messages: [] }) });
}
