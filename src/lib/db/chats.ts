import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
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
 * Maximum number of chats returned by a single call to `listChatsPage`.
 *
 * Used by the home-screen / history route to keep the JSON payload bounded.
 * Callers that need deeper history can pass a higher `limit` (capped at 100)
 * or chain via the `before` cursor.
 */
export const DEFAULT_CHATS_PAGE_SIZE = 20;
export const MAX_CHATS_PAGE_SIZE = 100;

export interface ListChatsPageOptions {
  /** How many chats to return. Defaults to {@link DEFAULT_CHATS_PAGE_SIZE}, capped at {@link MAX_CHATS_PAGE_SIZE}. */
  limit?: number;
  /**
   * Cursor for pagination — return chats whose `updatedAt` is strictly less than this epoch-second value.
   * Pass `undefined` (or omit) to fetch the most recent page.
   */
  before?: number;
}

export interface ListChatsPageResult {
  chats: ChatWithMessages[];
  nextCursor: number | null;
}

/**
 * List a paginated, JOIN-friendly page of chats (each with its messages) for an owner.
 *
 * Replaces the N+1 in {@link listChatsWithMessages} with two queries:
 *   1. Top-N chats ordered by `updatedAt` desc, optionally filtered by an `updatedAt` cursor.
 *   2. A single `messages` query for `chat_id IN (…)`, ordered by `(chat_id, created_at)`.
 * The in-memory pass groups the rows by `chatId` so each chat receives its
 * own chronologically-ordered message list. This keeps the round-trip count
 * constant regardless of how many chats are on the page.
 *
 * @param ownerId - When provided, scopes the page to a single owner. When omitted, returns chats across all owners.
 * @param options - Pagination knobs. `limit` defaults to 20, capped at 100. `before` is an `updatedAt` cursor (seconds).
 * @returns `{ chats, nextCursor }` — `nextCursor` is the `updatedAt` of the last returned chat (use it as the `before` value to fetch the next page) or `null` when there are no more chats.
 * @throws Error if the underlying SQLite database is unavailable.
 */
export function listChatsPage(
  ownerId?: string,
  options: ListChatsPageOptions = {}
): ListChatsPageResult {
  const db = getDb();
  const limit = Math.min(
    MAX_CHATS_PAGE_SIZE,
    Math.max(1, options.limit ?? DEFAULT_CHATS_PAGE_SIZE)
  );

  const cursorCondition =
    typeof options.before === "number"
      ? lt(chats.updatedAt, options.before)
      : undefined;

  const chatList = ownerId
    ? db
        .select()
        .from(chats)
        .where(
          cursorCondition
            ? and(eq(chats.ownerId, ownerId), cursorCondition)
            : eq(chats.ownerId, ownerId)
        )
        .orderBy(desc(chats.updatedAt))
        .limit(limit)
        .all()
    : db
        .select()
        .from(chats)
        .where(cursorCondition ?? undefined)
        .orderBy(desc(chats.updatedAt))
        .limit(limit)
        .all();

  if (chatList.length === 0) {
    return { chats: [], nextCursor: null };
  }

  const chatIds = chatList.map((chat) => chat.id);
  const chatIdSet = new Set(chatIds);

  const allMessages = db
    .select()
    .from(messages)
    .where(inArray(messages.chatId, chatIds))
    .orderBy(asc(messages.chatId), asc(messages.createdAt))
    .all();

  const messagesByChatId = new Map<string, MessageRecord[]>();
  for (const message of allMessages) {
    // Defensive — `inArray` already filters, but keep the Set check explicit
    // so the mapping never picks up a stray row from a parallel insert.
    if (!chatIdSet.has(message.chatId)) continue;
    const bucket = messagesByChatId.get(message.chatId);
    if (bucket) {
      bucket.push(message);
    } else {
      messagesByChatId.set(message.chatId, [message]);
    }
  }

  const chatsWithMessages: ChatWithMessages[] = chatList.map((chat) => ({
    ...chat,
    messages: messagesByChatId.get(chat.id) ?? [],
  }));

  const nextCursor =
    chatList.length < limit ? null : chatList[chatList.length - 1]?.updatedAt ?? null;

  return { chats: chatsWithMessages, nextCursor };
}

/**
 * List all chats (with their messages) owned by a user (or all chats when no owner is given).
 *
 * Note: this is O(chats × messages) — it issues one message-select per chat. Kept
 * for callers that need the complete history in one shot (e.g. export tooling).
 * The home-screen / `/api/chats` route uses {@link listChatsPage} instead, which
 * runs at most two queries per page.
 *
 * @param ownerId - When provided, scopes to a single owner. When omitted, returns every chat in the database.
 * @returns Array of `ChatWithMessages` with messages ordered by `createdAt` ascending. Chats themselves are ordered by `updatedAt` descending.
 * @throws Error if the underlying SQLite database is unavailable.
 */
export function listChatsWithMessages(ownerId?: string): ChatWithMessages[] {
  const db = getDb();
  const chatList = ownerId ? listChats(ownerId) : listChats();
  if (chatList.length === 0) return [];
  const ids = chatList.map((chat) => chat.id);
  const allMessages = db
    .select()
    .from(messages)
    .where(inArray(messages.chatId, ids))
    .orderBy(asc(messages.chatId), asc(messages.createdAt))
    .all();
  const messagesByChatId = new Map<string, MessageRecord[]>();
  for (const message of allMessages) {
    const bucket = messagesByChatId.get(message.chatId);
    if (bucket) bucket.push(message);
    else messagesByChatId.set(message.chatId, [message]);
  }
  return chatList.map((chat) => ({
    ...chat,
    messages: messagesByChatId.get(chat.id) ?? [],
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
    // Chat doesn't exist yet — create it for the current owner.
    // This handles the case where the client created a chat locally first
    // and is now syncing it to the server.
    if (ownerId) {
      createChat(chatId, ownerId);
    } else {
      createChat(chatId);
    }
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
    // Chat doesn't exist yet — create it for the current owner.
    // This handles the case where the client created a chat locally first
    // and is now syncing it to the server.
    if (ownerId) {
      createChat(chatId, ownerId);
    } else {
      createChat(chatId);
    }
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
