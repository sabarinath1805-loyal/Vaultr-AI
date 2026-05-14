import type { Message } from "ai/react";
import type { ChatSession, ChatSessions } from "@/lib/api/chats";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  base64Images: string[] | null;
  chats: Record<string, ChatSession>;
  currentChatId: string | null;
  selectedModel: string | null;
  userName: string;
  isDownloading: boolean;
  downloadProgress: number;
  downloadingModel: string | null;
  hasLoadedChats: boolean;
}

interface Actions {
  setBase64Images: (base64Images: string[] | null) => void;
  setCurrentChatId: (chatId: string) => void;
  setSelectedModel: (selectedModel: string) => void;
  loadChats: () => Promise<void>;
  loadChatById: (chatId: string) => Promise<ChatSession | undefined>;
  getChatById: (chatId: string) => ChatSession | undefined;
  getMessagesById: (chatId: string) => Message[];
  saveMessages: (chatId: string, messages: Message[]) => Promise<void>;
  handleDelete: (chatId: string, messageId?: string) => Promise<void>;
  setUserName: (userName: string) => void;
  startDownload: (modelName: string) => void;
  stopDownload: () => void;
  setDownloadProgress: (progress: number) => void;
}

const syncChatMessages = async (chatId: string, messages: Message[]) => {
  await fetch(`/api/chats/${chatId}/messages`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt:
          message.createdAt instanceof Date
            ? Math.floor(message.createdAt.getTime() / 1000)
            : undefined,
      })),
    }),
  });
};

const syncQueues = new Map<string, Promise<void>>();
const legacyDefaultUserName = ["Anon", "ymous"].join("");

const useChatStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      base64Images: null,
      chats: {},
      currentChatId: null,
      selectedModel: null,
      userName: "Local User",
      isDownloading: false,
      downloadProgress: 0,
      downloadingModel: null,
      hasLoadedChats: false,

      setBase64Images: (base64Images) => set({ base64Images }),
      setUserName: (userName) => set({ userName }),

      setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      loadChats: async () => {
        const response = await fetch("/api/chats");
        const data = (await response.json()) as { chats: ChatSessions };

        set({
          chats: data.chats,
          hasLoadedChats: true,
        });
      },
      loadChatById: async (chatId) => {
        const response = await fetch(`/api/chats/${chatId}`);

        if (!response.ok) {
          return undefined;
        }

        const data = (await response.json()) as { chat: ChatSession };

        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: data.chat,
          },
        }));

        return data.chat;
      },
      getChatById: (chatId) => {
        const state = get();
        return state.chats[chatId];
      },
      getMessagesById: (chatId) => {
        const state = get();
        return state.chats[chatId]?.messages || [];
      },
      saveMessages: async (chatId, messages) => {
        set((state) => {
          const existingChat = state.chats[chatId];
          const now = new Date().toISOString();

          return {
            chats: {
              ...state.chats,
              [chatId]: {
                id: chatId,
                messages: [...messages],
                createdAt: existingChat?.createdAt || now,
                updatedAt: now,
                title: existingChat?.title || "New chat",
              },
            },
          };
        });

        const previousSync = syncQueues.get(chatId) || Promise.resolve();
        const nextSync = previousSync
          .catch(() => undefined)
          .then(() => syncChatMessages(chatId, messages));

        syncQueues.set(chatId, nextSync);

        try {
          await nextSync;
        } catch (error) {
          console.error("Failed to sync chat messages:", error);
        } finally {
          if (syncQueues.get(chatId) === nextSync) {
            syncQueues.delete(chatId);
          }
        }
      },
      handleDelete: async (chatId, messageId) => {
        const chat = get().chats[chatId];

        if (!chat) return;

        set((state) => {
          if (messageId) {
            const updatedMessages = chat.messages.filter(
              (message) => message.id !== messageId
            );
            return {
              chats: {
                ...state.chats,
                [chatId]: {
                  ...chat,
                  messages: updatedMessages,
                },
              },
            };
          }

          const { [chatId]: _, ...remainingChats } = state.chats;
          return {
            chats: remainingChats,
          };
        });

        if (messageId) {
          await syncChatMessages(
            chatId,
            chat.messages.filter((message) => message.id !== messageId)
          );
          return;
        }

        await fetch(`/api/chats/${chatId}`, {
          method: "DELETE",
        });
      },

      startDownload: (modelName) =>
        set({ isDownloading: true, downloadingModel: modelName, downloadProgress: 0 }),
      stopDownload: () =>
        set({ isDownloading: false, downloadingModel: null, downloadProgress: 0 }),
      setDownloadProgress: (progress) => set({ downloadProgress: progress }),
    }),
    {
      name: "nextjs-ollama-ui-state",
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        userName: state.userName,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<State>;

        return {
          ...currentState,
          selectedModel: persisted.selectedModel || currentState.selectedModel,
          userName:
            persisted.userName && persisted.userName !== legacyDefaultUserName
              ? persisted.userName
              : currentState.userName,
        };
      },
    }
  )
);

export default useChatStore;