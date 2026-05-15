import type { Message } from "ai/react";
import type { ChatSession, ChatSessions } from "@/lib/api/chats";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  base64Images: string[] | null;
  chats: Record<string, ChatSession>;
  currentChatId: string | null;
  pendingComposerText: string | null;
  pendingAttachedDocumentIds: string[];
  pendingWorkflow: AttachedWorkflow | null;
  composerResetToken: number;
  selectedModel: string | null;
  userName: string;
  organisation: string;
  ollamaUrl: string;
  serperApiKey: string;
  thinkingModeDefault: boolean;
  themePreference: "light" | "dark" | "system";
  defaultModelPreference: string;
  autoCleanupConversations: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadingModel: string | null;
  hasLoadedChats: boolean;
}

export interface AttachedWorkflow {
  id: string;
  title: string;
  prompt: string;
}

interface Actions {
  setBase64Images: (base64Images: string[] | null) => void;
  setCurrentChatId: (chatId: string | null) => void;
  setPendingComposerText: (text: string | null) => void;
  setPendingAttachedDocumentIds: (documentIds: string[]) => void;
  setPendingWorkflow: (workflow: AttachedWorkflow | null) => void;
  resetComposerState: () => void;
  setSelectedModel: (selectedModel: string | null) => void;
  loadChats: () => Promise<void>;
  loadChatById: (chatId: string) => Promise<ChatSession | undefined>;
  getChatById: (chatId: string) => ChatSession | undefined;
  getMessagesById: (chatId: string) => Message[];
  saveMessages: (chatId: string, messages: Message[]) => Promise<void>;
  handleDelete: (chatId: string, messageId?: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  setUserName: (userName: string) => void;
  setOrganisation: (organisation: string) => void;
  setOllamaUrl: (ollamaUrl: string) => void;
  setSerperApiKey: (serperApiKey: string) => void;
  setThinkingModeDefault: (enabled: boolean) => void;
  setThemePreference: (theme: "light" | "dark" | "system") => void;
  setDefaultModelPreference: (modelId: string) => void;
  setAutoCleanupConversations: (enabled: boolean) => void;
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
      pendingComposerText: null,
      pendingAttachedDocumentIds: [],
      pendingWorkflow: null,
      composerResetToken: 0,
      selectedModel: null,
      userName: "Local User",
      organisation: "",
      ollamaUrl: "http://localhost:11434",
      serperApiKey: "[REDACTED]",
      thinkingModeDefault: false,
      themePreference: "light",
      defaultModelPreference: "qwen3:8b",
      autoCleanupConversations: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadingModel: null,
      hasLoadedChats: false,

      setBase64Images: (base64Images) => set({ base64Images }),
      setUserName: (userName) => set({ userName }),
      setOrganisation: (organisation) => set({ organisation }),
      setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
      setSerperApiKey: (serperApiKey) => set({ serperApiKey }),
      setThinkingModeDefault: (enabled) => set({ thinkingModeDefault: enabled }),
      setThemePreference: (theme) => set({ themePreference: theme }),
      setDefaultModelPreference: (modelId) => set({ defaultModelPreference: modelId }),
      setAutoCleanupConversations: (enabled) => set({ autoCleanupConversations: enabled }),

      setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
      setPendingComposerText: (text) => set({ pendingComposerText: text }),
      setPendingAttachedDocumentIds: (documentIds) =>
        set({ pendingAttachedDocumentIds: documentIds }),
      setPendingWorkflow: (workflow) => set({ pendingWorkflow: workflow }),
      resetComposerState: () =>
        set((state) => ({
          base64Images: null,
          currentChatId: null,
          pendingComposerText: null,
          pendingAttachedDocumentIds: [],
          pendingWorkflow: null,
          composerResetToken: state.composerResetToken + 1,
        })),
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
      clearAllChats: async () => {
        set({ chats: {}, currentChatId: null, pendingComposerText: null, pendingAttachedDocumentIds: [], pendingWorkflow: null });
        await fetch("/api/chats", {
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
        organisation: state.organisation,
        ollamaUrl: state.ollamaUrl,
        serperApiKey: state.serperApiKey,
        thinkingModeDefault: state.thinkingModeDefault,
        themePreference: state.themePreference,
        defaultModelPreference: state.defaultModelPreference,
        autoCleanupConversations: state.autoCleanupConversations,
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
          organisation: persisted.organisation || currentState.organisation,
          ollamaUrl: persisted.ollamaUrl || currentState.ollamaUrl,
          serperApiKey: persisted.serperApiKey || currentState.serperApiKey,
          thinkingModeDefault:
            typeof persisted.thinkingModeDefault === "boolean"
              ? persisted.thinkingModeDefault
              : currentState.thinkingModeDefault,
          themePreference: persisted.themePreference || currentState.themePreference,
          defaultModelPreference:
            persisted.defaultModelPreference || currentState.defaultModelPreference,
          autoCleanupConversations:
            typeof persisted.autoCleanupConversations === "boolean"
              ? persisted.autoCleanupConversations
              : currentState.autoCleanupConversations,
        };
      },
    }
  )
);

export default useChatStore;