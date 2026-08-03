import type { ChatMessage as Message } from "@/lib/chat-types";
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

/** Convert a persisted message row to the client chat-message shape. */
export function toClientMessage(message: MessageRecord): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt * 1000),
  };
}

/** Convert a persisted chat and its messages to the client session shape. */
export function toClientChat(chat: ChatWithMessages): ChatSession {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: toIsoString(chat.createdAt),
    updatedAt: toIsoString(chat.updatedAt),
    messages: chat.messages.map(toClientMessage),
  };
}
