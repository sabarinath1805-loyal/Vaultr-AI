import { and, asc, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from ".";
import { chats, messages } from "./schema";

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface MessageInput {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
}

export interface ChatWithMessages extends ChatRecord {
  messages: MessageRecord[];
}

export interface ChatInput {
  id?: string;
  title?: string;
  ownerId?: string;
}

const now = () => Math.floor(Date.now() / 1000);

const titleFromContent = (content: string) => {
  const title = content.trim().replace(/\s+/g, " ");
  return title.length > 60 ? `${title.slice(0, 57)}...` : title || "New chat";
};

export function listChats(ownerId?: string): ChatRecord[] {
  const db = getDb();
  if (ownerId) {
    return db
      .select()
      .from(chats)
      .where(eq(chats.ownerId, ownerId))
      .orderBy(desc(chats.updatedAt))
      .all();
  }
  return db.select().from(chats).orderBy(desc(chats.updatedAt)).all();
}

export function createChat(id: string = uuidv4(), ownerId: string = "anonymous"): ChatRecord {
  const db = getDb();
  const timestamp = now();
  const chat = {
    id,
    title: "New chat",
    createdAt: timestamp,
    updatedAt: timestamp,
    ownerId,
  };

  db.insert(chats).values(chat).onConflictDoNothing().run();

  return chat;
}

export function getChat(id: string, ownerId?: string): ChatWithMessages | null {
  const db = getDb();
  const conditions = ownerId
    ? and(eq(chats.id, id), eq(chats.ownerId, ownerId))
    : eq(chats.id, id);
  const chat = db.select().from(chats).where(conditions).get();

  if (!chat) {
    return null;
  }

  const chatMessages = db
    .select()
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(asc(messages.createdAt))
    .all();

  return {
    ...chat,
    messages: chatMessages,
  };
}

export function listChatsWithMessages(ownerId?: string): ChatWithMessages[] {
  const db = getDb();
  const chatList = ownerId ? listChats(ownerId) : listChats();
  return chatList.map((chat) => ({
    ...chat,
    messages: db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chat.id))
      .orderBy(asc(messages.createdAt))
      .all(),
  }));
}

export function deleteChat(id: string, ownerId?: string): boolean {
  const db = getDb();
  const conditions = ownerId
    ? and(eq(chats.id, id), eq(chats.ownerId, ownerId))
    : eq(chats.id, id);
  const result = db.delete(chats).where(conditions).run();
  return result.changes > 0;
}

export function renameChat(id: string, title: string, ownerId?: string): boolean {
  const db = getDb();
  const timestamp = now();
  const conditions = ownerId
    ? and(eq(chats.id, id), eq(chats.ownerId, ownerId))
    : eq(chats.id, id);
  const result = db
    .update(chats)
    .set({ title, updatedAt: timestamp })
    .where(conditions)
    .run();
  return result.changes > 0;
}

export function addMessage(
  chatId: string,
  message: MessageInput,
  ownerId?: string
): MessageRecord {
  const db = getDb();

  // Verify chat exists and (if ownerId provided) belongs to the user
  const conditions = ownerId
    ? and(eq(chats.id, chatId), eq(chats.ownerId, ownerId))
    : eq(chats.id, chatId);
  const chat = db.select().from(chats).where(conditions).get();

  if (!chat) {
    // If chat doesn't exist and no ownerId, create with anonymous owner
    // If ownerId provided, this is a security violation
    if (ownerId) {
      throw new Error("Chat not found or access denied");
    }
    createChat(chatId);
  }

  const timestamp = message.createdAt ?? now();
  const messageRecord = {
    id: uuidv4(), // Always generate server-side
    chatId,
    role: message.role,
    content: message.content,
    createdAt: timestamp,
  };

  db.transaction(() => {
    db.insert(messages).values(messageRecord).onConflictDoNothing().run();

    const existingMessages = db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))
      .all();

    const firstMessage = existingMessages[0];

    db.update(chats)
      .set({
        title: firstMessage ? titleFromContent(firstMessage.content) : "New chat",
        updatedAt: timestamp,
      })
      .where(eq(chats.id, chatId))
      .run();
  });

  return messageRecord;
}

export function replaceMessages(
  chatId: string,
  replacementMessages: MessageInput[],
  ownerId?: string
): MessageRecord[] {
  const db = getDb();

  // Verify chat exists and (if ownerId provided) belongs to the user
  const conditions = ownerId
    ? and(eq(chats.id, chatId), eq(chats.ownerId, ownerId))
    : eq(chats.id, chatId);
  const chat = db.select().from(chats).where(conditions).get();

  if (!chat) {
    if (ownerId) {
      throw new Error("Chat not found or access denied");
    }
    createChat(chatId);
  }

  const timestamp = now();
  const messageRecords: MessageRecord[] = replacementMessages.map(
    (message, index) => ({
      id: uuidv4(), // Always generate server-side
      chatId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ?? timestamp + index,
    })
  );

  db.transaction(() => {
    db.delete(messages).where(eq(messages.chatId, chatId)).run();

    if (messageRecords.length > 0) {
      db.insert(messages).values(messageRecords).run();
    }

    db.update(chats)
      .set({
        title: messageRecords[0]
          ? titleFromContent(messageRecords[0].content)
          : "New chat",
        updatedAt: timestamp,
      })
      .where(eq(chats.id, chatId))
      .run();
  });

  return messageRecords;
}
