import { NextResponse } from "next/server";
import { createChat, deleteAllChats, listChatsWithMessages } from "@/lib/db/chats";
import { toClientChat } from "@/lib/api/chats";
import { scanContractFormData } from "@/lib/api/contract-scanner";
import { DatabaseUnavailableError } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const chats = listChatsWithMessages().reduce<Record<string, ReturnType<typeof toClientChat>>>(
      (acc, chat) => {
        acc[chat.id] = toClientChat(chat);
        return acc;
      },
      {}
    );

    return NextResponse.json({ chats });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message, chats: {} }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return scanContractFormData(await req.formData());
  }

  const body = await req.json().catch(() => ({}));
  try {
    const chat = createChat(body.id);

    return NextResponse.json({ chat: toClientChat({ ...chat, messages: [] }) });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export async function DELETE() {
  try {
    deleteAllChats();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
