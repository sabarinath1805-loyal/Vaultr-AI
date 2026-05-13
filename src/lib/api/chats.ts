import type { Message } from "ai/react";
import type { ChatWithMessages, MessageRecord } from "@/lib/db/chats";

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  title: string;
}

export type ChatSessions = Record<string, ChatSession>;

const toIsoString = (timestamp: number) =>
  new Date(timestamp * 1000).toISOString();

export function toClientMessage(message: MessageRecord): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
  };
}

export function toClientChat(chat: ChatWithMessages): ChatSession {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: toIsoString(chat.createdAt),
    updatedAt: toIsoString(chat.updatedAt),
    messages: chat.messages.map(toClientMessage),
  };
}
