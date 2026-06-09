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

/**
 * List chat sessions ordered by most-recently-updated first.
 *
 * @param ownerId - When provided, scopes the result to a single owner. When omitted, returns all chats in the database.
 * @returns Array of `ChatRecord` objects sorted by `updatedAt` descending. Empty array when no chats exist.
 * @throws Error if the underlying SQLite database is unavailable (via `getDb()`).
 */
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

/**
 * Create a new chat row, or no-op if a row with the same id already exists.
 *
 * @param id - UUID for the new chat. Defaults to a fresh `uuidv4()`. Must be unique.
 * @param ownerId - Supabase user id (or `"anonymous"` for local dev) that owns this chat. Defaults to `"anonymous"`.
 * @returns The created (or pre-existing) `ChatRecord`. The `onConflictDoNothing` upsert means the returned `title`/`createdAt` may not match the actual row if the id collided.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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

/**
 * Fetch a chat and all its messages.
 *
 * @param id - Chat id to look up.
 * @param ownerId - When provided, returns the chat only if its `ownerId` matches. When omitted, returns the chat regardless of owner (used by unauthenticated local-dev paths).
 * @returns A `ChatWithMessages` object with messages ordered by `createdAt` ascending, or `null` when no matching chat exists.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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

/**
 * List all chats (with their messages) owned by a user (or all chats when no owner is given).
 *
 * Note: this is O(chats × messages) — it issues one message-select per chat. For the home screen, prefer `listChats` and lazy-load messages per chat.
 *
 * @param ownerId - When provided, scopes to a single owner. When omitted, returns every chat in the database.
 * @returns Array of `ChatWithMessages` with messages ordered by `createdAt` ascending. Chats themselves are ordered by `updatedAt` descending.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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

/**
 * Delete a chat (and, via the FK cascade, all of its messages).
 *
 * @param id - Chat id to delete.
 * @param ownerId - When provided, only deletes the chat if its `ownerId` matches. When omitted, deletes regardless of owner.
 * @returns `true` if a row was actually removed, `false` if the chat did not exist (or did not belong to the supplied owner).
 * @throws Error if the underlying SQLite database is unavailable.
 */
export function deleteChat(id: string, ownerId?: string): boolean {
  const db = getDb();
  const conditions = ownerId
    ? and(eq(chats.id, id), eq(chats.ownerId, ownerId))
    : eq(chats.id, id);
  const result = db.delete(chats).where(conditions).run();
  return result.changes > 0;
}

/**
 * Update a chat's title and its `updatedAt` timestamp.
 *
 * @param id - Chat id to rename.
 * @param title - New title (will be trimmed and truncated to 60 characters).
 * @param ownerId - When provided, only updates if the chat's `ownerId` matches. When omitted, updates regardless of owner.
 * @returns `true` if the row was updated, `false` if the chat was not found.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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

/**
 * Insert a message into a chat and auto-update the chat's title to the first message's content.
 * The message `id` is always generated server-side via `uuidv4()` (never use the optional `id` from `MessageInput`).
 *
 * @param chatId - Target chat for this message.
 * @param message - Object containing `{ role, content }`. The optional `id` field is ignored; `createdAt` defaults to `now()` if omitted.
 * @param ownerId - When provided, creates a security error if the chat exists but belongs to a different owner.
 * @returns The inserted `MessageRecord` with the server-generated `id` (a fresh UUID) and the `createdAt` used.
 * @throws Error if `ownerId` is provided but the chat does not exist or belongs to another user.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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

/**
 * Replace the entire message list for a chat (delete all then re-insert).
 * All `id`s are generated server-side via `uuidv4()`.
 *
 * @param chatId - Target chat.
 * @param replacementMessages - Full list of messages that should exist in the chat after this call. Empty array is allowed (clears the chat).
 * @param ownerId - When provided, throws if the chat exists but belongs to a different owner. When omitted, the chat is auto-created with `ownerId = "anonymous"`.
 * @returns The new `MessageRecord[]` in the same order as `replacementMessages`, each with a server-generated `id`.
 * @throws Error if `ownerId` is provided and the chat does not exist or belongs to another user.
 * @throws Error if the underlying SQLite database is unavailable.
 */
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
