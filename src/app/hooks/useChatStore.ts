import type { Message } from "ai/react";
import type { ChatSession, ChatSessions } from "@/lib/api/chats";
import type { ContractAnalysis } from "@/lib/contract-scanner";
import { GROQ_DEFAULT_MODEL, isCloudModel, isLexModel } from "@/lib/models";
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
  cloudMode: boolean;
  usePrivacyMode: boolean;
  userName: string;
  organisation: string;
  ollamaUrl: string;
  thinkingModeDefault: boolean;
  themePreference: "light" | "dark" | "system";
  defaultModelPreference: string;
  autoCleanupConversations: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadingModel: string | null;
  hasLoadedChats: boolean;
  scanProgress: number;
  scanningStep: string;
  scanResult: ContractAnalysis | null;
  isScanning: boolean;
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
  setCloudMode: (enabled: boolean, privateModel?: string | null) => void;
  setUsePrivacyMode: (enabled: boolean) => void;
  loadChats: () => Promise<void>;
  loadChatById: (chatId: string) => Promise<ChatSession | undefined>;
  getChatById: (chatId: string) => ChatSession | undefined;
  getMessagesById: (chatId: string) => Message[];
  saveMessages: (chatId: string, messages: Message[]) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  handleDelete: (chatId: string, messageId?: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  setUserName: (userName: string) => void;
  setOrganisation: (organisation: string) => void;
  setOllamaUrl: (ollamaUrl: string) => void;
  setThinkingModeDefault: (enabled: boolean) => void;
  setThemePreference: (theme: "light" | "dark" | "system") => void;
  setDefaultModelPreference: (modelId: string) => void;
  setAutoCleanupConversations: (enabled: boolean) => void;
  startDownload: (modelName: string) => void;
  stopDownload: () => void;
  setDownloadProgress: (progress: number) => void;
  setScanProgress: (progress: number) => void;
  setScanningStep: (step: string) => void;
  setScanResult: (result: ContractAnalysis | null) => void;
  setIsScanning: (scanning: boolean) => void;
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
      selectedModel: GROQ_DEFAULT_MODEL,
      cloudMode: true,
      usePrivacyMode: false,
      userName: "Local User",
      organisation: "",
      ollamaUrl: "http://localhost:11434",
      thinkingModeDefault: false,
      themePreference: "light",
      defaultModelPreference: GROQ_DEFAULT_MODEL,
      autoCleanupConversations: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadingModel: null,
      hasLoadedChats: false,
      scanProgress: 0,
      scanningStep: "Reading document...",
      scanResult: null,
      isScanning: false,

      setBase64Images: (base64Images) => set({ base64Images }),
      setUserName: (userName) => set({ userName }),
      setOrganisation: (organisation) => set({ organisation }),
      setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
      setThinkingModeDefault: (enabled) => set({ thinkingModeDefault: enabled }),
      setThemePreference: (theme) => {
        window.localStorage.setItem("vaultr-theme", theme);
        set({ themePreference: theme });
      },
      setDefaultModelPreference: (modelId) => {
        window.localStorage.setItem("vaultr-default-model", modelId);
        set({ defaultModelPreference: modelId });
      },
      setAutoCleanupConversations: (enabled) => {
        window.localStorage.setItem("vaultr-auto-cleanup", String(enabled));
        set({ autoCleanupConversations: enabled });
      },

      setCurrentChatId: (chatId) =>
        set((state) =>
          state.currentChatId === chatId ? state : { currentChatId: chatId }
        ),
      setPendingComposerText: (text) =>
        set({ pendingComposerText: typeof text === "string" ? text : null }),
      setPendingAttachedDocumentIds: (documentIds) =>
        set((state) =>
          state.pendingAttachedDocumentIds.join("\u0000") === documentIds.join("\u0000")
            ? state
            : { pendingAttachedDocumentIds: documentIds }
        ),
      setPendingWorkflow: (workflow) =>
        set((state) =>
          state.pendingWorkflow?.id === workflow?.id &&
          state.pendingWorkflow?.prompt === workflow?.prompt
            ? state
            : { pendingWorkflow: workflow }
        ),
      resetComposerState: () =>
        set((state) => ({
          base64Images: null,
          currentChatId: null,
          pendingComposerText: null,
          pendingAttachedDocumentIds: [],
          pendingWorkflow: null,
          composerResetToken: state.composerResetToken + 1,
        })),
      setSelectedModel: (selectedModel) =>
        set((state) =>
          state.selectedModel === selectedModel ? state : { selectedModel }
        ),
      setCloudMode: (enabled, privateModel) => {
        window.localStorage.setItem("vaultr-cloud-mode", String(enabled));
        window.localStorage.setItem("vaultr-privacy-mode", String(!enabled));
        set((state) => {
          const selectedModel = enabled
            ? GROQ_DEFAULT_MODEL
            : privateModel || state.selectedModel;
          const defaultModelPreference = enabled
            ? GROQ_DEFAULT_MODEL
            : state.defaultModelPreference;

          if (
            state.cloudMode === enabled &&
            state.usePrivacyMode === !enabled &&
            state.selectedModel === selectedModel &&
            state.defaultModelPreference === defaultModelPreference
          ) {
            return state;
          }

          return {
            cloudMode: enabled,
            usePrivacyMode: !enabled,
            selectedModel,
            defaultModelPreference,
          };
        });
      },
      setUsePrivacyMode: (enabled) => {
        window.localStorage.setItem("vaultr-privacy-mode", String(enabled));
        window.localStorage.setItem("vaultr-cloud-mode", String(!enabled));
        set((state) => {
          const selectedModel = enabled ? state.selectedModel : GROQ_DEFAULT_MODEL;
          const defaultModelPreference = enabled
            ? state.defaultModelPreference
            : GROQ_DEFAULT_MODEL;

          if (
            state.cloudMode === !enabled &&
            state.usePrivacyMode === enabled &&
            state.selectedModel === selectedModel &&
            state.defaultModelPreference === defaultModelPreference
          ) {
            return state;
          }

          return {
            cloudMode: !enabled,
            usePrivacyMode: enabled,
            selectedModel,
            defaultModelPreference,
          };
        });
      },
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
      renameChat: async (chatId, title) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return;

        set((state) => {
          const chat = state.chats[chatId];
          if (!chat) return state;
          return {
            chats: {
              ...state.chats,
              [chatId]: {
                ...chat,
                title: trimmedTitle,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });

        const response = await fetch(`/api/chats/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle }),
        });

        if (response.ok) {
          const data = (await response.json()) as { chat: ChatSession };
          set((state) => ({
            chats: {
              ...state.chats,
              [chatId]: data.chat,
            },
          }));
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
      setScanProgress: (progress) =>
        set((state) => (state.scanProgress === progress ? state : { scanProgress: progress })),
      setScanningStep: (step) =>
        set((state) => (state.scanningStep === step ? state : { scanningStep: step })),
      setScanResult: (result) =>
        set((state) => (state.scanResult === result ? state : { scanResult: result })),
      setIsScanning: (scanning) =>
        set((state) => (state.isScanning === scanning ? state : { isScanning: scanning })),
    }),
    {
      name: "nextjs-ollama-ui-state",
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        cloudMode: state.cloudMode,
        usePrivacyMode: state.usePrivacyMode,
        userName: state.userName,
        organisation: state.organisation,
        ollamaUrl: state.ollamaUrl,
        thinkingModeDefault: state.thinkingModeDefault,
        themePreference: state.themePreference,
        defaultModelPreference: state.defaultModelPreference,
        autoCleanupConversations: state.autoCleanupConversations,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<State>;

        return {
          ...currentState,
          cloudMode: (() => {
            if (typeof window !== "undefined") {
              const savedCloudMode = window.localStorage.getItem("vaultr-cloud-mode");
              if (savedCloudMode !== null) return savedCloudMode === "true";
              const savedPrivacyMode = window.localStorage.getItem("vaultr-privacy-mode");
              if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
            }
            if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
            if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
            return currentState.cloudMode;
          })(),
          usePrivacyMode: (() => {
            if (typeof window !== "undefined") {
              const savedCloudMode = window.localStorage.getItem("vaultr-cloud-mode");
              if (savedCloudMode !== null) return savedCloudMode !== "true";
              const savedPrivacyMode = window.localStorage.getItem("vaultr-privacy-mode");
              if (savedPrivacyMode !== null) return savedPrivacyMode === "true";
            }
            if (typeof persisted.cloudMode === "boolean") return !persisted.cloudMode;
            if (typeof persisted.usePrivacyMode === "boolean") return persisted.usePrivacyMode;
            return currentState.usePrivacyMode;
          })(),
          selectedModel: (() => {
            const cloudMode = (() => {
              if (typeof window !== "undefined") {
                const savedCloudMode = window.localStorage.getItem("vaultr-cloud-mode");
                if (savedCloudMode !== null) return savedCloudMode === "true";
                const savedPrivacyMode = window.localStorage.getItem("vaultr-privacy-mode");
                if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
              }
              if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
              if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
              return currentState.cloudMode;
            })();
            if (cloudMode) {
              return persisted.selectedModel && isCloudModel(persisted.selectedModel)
                ? persisted.selectedModel
                : GROQ_DEFAULT_MODEL;
            }
            return persisted.selectedModel && isLexModel(persisted.selectedModel)
              ? persisted.selectedModel
              : currentState.selectedModel;
          })(),
          userName:
            persisted.userName && persisted.userName !== legacyDefaultUserName
              ? persisted.userName
              : currentState.userName,
          organisation: persisted.organisation || currentState.organisation,
          ollamaUrl: persisted.ollamaUrl || currentState.ollamaUrl,
          thinkingModeDefault:
            typeof persisted.thinkingModeDefault === "boolean"
              ? persisted.thinkingModeDefault
              : currentState.thinkingModeDefault,
          themePreference:
            (typeof window !== "undefined" &&
              (window.localStorage.getItem("vaultr-theme") as
                | "light"
                | "dark"
                | "system"
                | null)) ||
            persisted.themePreference ||
            currentState.themePreference,
          defaultModelPreference: (() => {
            const cloudMode = (() => {
              if (typeof window !== "undefined") {
                const savedCloudMode = window.localStorage.getItem("vaultr-cloud-mode");
                if (savedCloudMode !== null) return savedCloudMode === "true";
                const savedPrivacyMode = window.localStorage.getItem("vaultr-privacy-mode");
                if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
              }
              if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
              if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
              return currentState.cloudMode;
            })();
            if (cloudMode) return GROQ_DEFAULT_MODEL;
            const model =
              (typeof window !== "undefined" &&
                window.localStorage.getItem("vaultr-default-model")) ||
              persisted.defaultModelPreference ||
              currentState.defaultModelPreference;
            return isLexModel(model) ? model : currentState.defaultModelPreference;
          })(),
          autoCleanupConversations:
            typeof window !== "undefined" &&
            window.localStorage.getItem("vaultr-auto-cleanup") !== null
              ? window.localStorage.getItem("vaultr-auto-cleanup") === "true"
              : typeof persisted.autoCleanupConversations === "boolean"
              ? persisted.autoCleanupConversations
              : currentState.autoCleanupConversations,
        };
      },
    }
  )
);

export default useChatStore;