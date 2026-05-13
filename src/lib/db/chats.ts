import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from ".";
import { chats, messages } from "./schema";

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ChatWithMessages extends ChatRecord {
  messages: MessageRecord[];
}

const now = () => Math.floor(Date.now() / 1000);

const titleFromContent = (content: string) => {
  const title = content.trim().replace(/\s+/g, " ");
  return title.length > 60 ? `${title.slice(0, 57)}...` : title || "New chat";
};

export function listChats(): ChatRecord[] {
  return db.select().from(chats).orderBy(desc(chats.updatedAt)).all();
}

export function createChat(id = uuidv4()): ChatRecord {
  const timestamp = now();
  const chat = {
    id,
    title: "New chat",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.insert(chats).values(chat).onConflictDoNothing().run();

  return chat;
}

export function getChat(id: string): ChatWithMessages | null {
  const chat = db.select().from(chats).where(eq(chats.id, id)).get();

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

export function listChatsWithMessages(): ChatWithMessages[] {
  return listChats().map((chat) => ({
    ...chat,
    messages: db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chat.id))
      .orderBy(asc(messages.createdAt))
      .all(),
  }));
}

export function deleteChat(id: string) {
  db.delete(chats).where(eq(chats.id, id)).run();
}

export function addMessage(chatId: string, message: {
  id?: string;
  role: "user" | "assistant";
  content: string;
}): MessageRecord {
  const timestamp = now();
  const chat = db.select().from(chats).where(eq(chats.id, chatId)).get();

  if (!chat) {
    createChat(chatId);
  }

  const messageRecord = {
    id: message.id || uuidv4(),
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
  replacementMessages: {
    id?: string;
    role: "user" | "assistant";
    content: string;
  }[]
): MessageRecord[] {
  const timestamp = now();
  const chat = db.select().from(chats).where(eq(chats.id, chatId)).get();

  if (!chat) {
    createChat(chatId);
  }

  const messageRecords: MessageRecord[] = replacementMessages.map(
    (message, index) => ({
      id: message.id || uuidv4(),
      chatId,
      role: message.role,
      content: message.content,
      createdAt: timestamp + index,
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
