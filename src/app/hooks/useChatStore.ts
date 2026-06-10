import type { Message } from "ai/react";
import type { ChatSession, ChatSessions } from "@/lib/api/chats";
import type { ContractAnalysis } from "@/lib/contract-scanner";
import { ANTHROPIC_CORE_MODEL, isCloudModel, isLexModel } from "@/lib/models";
import { safeStorage } from "@/lib/safe-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const isSSR = typeof window === "undefined" || typeof indexedDB === "undefined";

const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isSSR) return null;
    try {
      const { get } = await import("idb-keyval");
      return (await get(name)) ?? null;
    } catch (err) {
      console.warn("Storage read failed (non-critical):", err);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isSSR) return;
    try {
      const { set } = await import("idb-keyval");
      await set(name, value);
    } catch (err) {
      console.warn("Storage write failed (non-critical):", err);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (isSSR) return;
    try {
      const { del } = await import("idb-keyval");
      await del(name);
    } catch (err) {
      console.warn("Storage remove failed (non-critical):", err);
    }
  },
};

interface State {
  base64Images: string[] | null;
  chats: Record<string, ChatSession>;
  currentChatId: string | null;
  pendingComposerText: string | null;
  pendingAttachedDocumentIds: string[];
  pendingWorkflow: AttachedWorkflow | null;
  customWorkflows: CustomWorkflow[];
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
  defaultJurisdiction: string;
  autoCleanupConversations: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadingModel: string | null;
  hasLoadedChats: boolean;
  scanProgress: number;
  scanningStep: string;
  scanResult: ContractAnalysis | null;
  isScanning: boolean;
  scanStartedAt: number | null;
  modelDownloads: Record<string, ModelDownloadState>;
}

export interface ModelDownloadState {
  progress: number;
  remainingBytes: number | null;
  completedBytes: number | null;
  totalBytes: number | null;
  status: string;
  error: string | null;
}

export interface AttachedWorkflow {
  id: string;
  title: string;
  prompt: string;
  requireDocumentUpload?: boolean;
}

export interface CustomWorkflow extends AttachedWorkflow {
  source: "custom";
}

interface Actions {
  setBase64Images: (base64Images: string[] | null) => void;
  setCurrentChatId: (chatId: string | null) => void;
  setPendingComposerText: (text: string | null) => void;
  setPendingAttachedDocumentIds: (documentIds: string[]) => void;
  setPendingWorkflow: (workflow: AttachedWorkflow | null) => void;
  addCustomWorkflow: (workflow: Omit<CustomWorkflow, "id" | "source">) => CustomWorkflow;
  updateCustomWorkflow: (workflowId: string, updates: Partial<Pick<CustomWorkflow, "title" | "prompt" | "requireDocumentUpload">>) => void;
  deleteCustomWorkflow: (workflowId: string) => void;
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
  setDefaultJurisdiction: (jurisdiction: string) => void;
  setAutoCleanupConversations: (enabled: boolean) => void;
  startDownload: (modelName: string) => void;
  stopDownload: () => void;
  setDownloadProgress: (progress: number) => void;
  setScanProgress: (progress: number) => void;
  setScanningStep: (step: string) => void;
  setScanResult: (result: ContractAnalysis | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setScanStartedAt: (startedAt: number | null) => void;
  setModelDownload: (modelId: string, download: ModelDownloadState) => void;
  clearModelDownload: (modelId: string) => void;
}

// Get auth headers with Bearer token for Supabase-authenticated requests
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }
    } catch {
      // Supabase not configured - continue without auth header
    }
  }
  return headers;
}

const syncChatMessages = async (chatId: string, messages: Message[]) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`/api/chats/${chatId}/messages`, {
    method: "PUT",
    headers: authHeaders,
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
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
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
      customWorkflows: [],
      composerResetToken: 0,
      selectedModel: ANTHROPIC_CORE_MODEL,
      cloudMode: true,
      usePrivacyMode: false,
      userName: "Local User",
      organisation: "",
      ollamaUrl: "http://localhost:11434",
      thinkingModeDefault: false,
      themePreference: "light",
      defaultModelPreference: ANTHROPIC_CORE_MODEL,
      defaultJurisdiction: "us",
      autoCleanupConversations: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadingModel: null,
      hasLoadedChats: false,
      scanProgress: 0,
      scanningStep: "Reading document...",
      scanResult: null,
      isScanning: false,
      scanStartedAt: null,
      modelDownloads: {},

      setBase64Images: (base64Images) => set({ base64Images }),
      setUserName: (userName) => set({ userName }),
      setOrganisation: (organisation) => set({ organisation }),
      setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
      setThinkingModeDefault: (enabled) => set({ thinkingModeDefault: enabled }),
      setThemePreference: (theme) => {
        safeStorage.setItem("vaultr-theme", theme);
        set({ themePreference: theme });
      },
      setDefaultModelPreference: (modelId) => {
        safeStorage.setItem("vaultr-default-model", modelId);
        set({ defaultModelPreference: modelId });
      },
      setDefaultJurisdiction: (jurisdiction) => {
        safeStorage.setItem("vaultr-default-jurisdiction", jurisdiction);
        set({ defaultJurisdiction: jurisdiction });
      },
      setAutoCleanupConversations: (enabled) => {
        safeStorage.setItem("vaultr-auto-cleanup", String(enabled));
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
      addCustomWorkflow: (workflow) => {
        const customWorkflow: CustomWorkflow = {
          id: `custom-${Date.now()}`,
          source: "custom",
          ...workflow,
        };
        set((state) => ({
          customWorkflows: [customWorkflow, ...state.customWorkflows],
        }));
        return customWorkflow;
      },
      updateCustomWorkflow: (workflowId, updates) => {
        set((state) => ({
          customWorkflows: state.customWorkflows.map((w) =>
            w.id === workflowId ? { ...w, ...updates } : w
          ),
        }));
      },
      deleteCustomWorkflow: (workflowId) => {
        set((state) => ({
          customWorkflows: state.customWorkflows.filter((w) => w.id !== workflowId),
        }));
      },
      resetComposerState: () =>
        set((state) => ({
          base64Images: null,
          currentChatId: null,
          pendingComposerText: null,
          pendingAttachedDocumentIds: state.pendingAttachedDocumentIds,
          pendingWorkflow: state.pendingWorkflow,
          composerResetToken: state.composerResetToken + 1,
        })),
      setSelectedModel: (selectedModel) =>
        set((state) =>
          state.selectedModel === selectedModel ? state : { selectedModel }
        ),
      setCloudMode: (enabled, privateModel) => {
        safeStorage.setItem("vaultr-cloud-mode", String(enabled));
        safeStorage.setItem("vaultr-privacy-mode", String(!enabled));
        set((state) => {
          const selectedModel = enabled
            ? ANTHROPIC_CORE_MODEL
            : privateModel || state.selectedModel;
          const defaultModelPreference = enabled
            ? ANTHROPIC_CORE_MODEL
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
        safeStorage.setItem("vaultr-privacy-mode", String(enabled));
        safeStorage.setItem("vaultr-cloud-mode", String(!enabled));
        set((state) => {
          const selectedModel = enabled ? state.selectedModel : ANTHROPIC_CORE_MODEL;
          const defaultModelPreference = enabled
            ? state.defaultModelPreference
            : ANTHROPIC_CORE_MODEL;

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
        const authHeaders = await getAuthHeaders();
        const response = await fetch("/api/chats", { headers: authHeaders });
        const data = (await response.json()) as { chats: ChatSessions };

        set({
          chats: data.chats,
          hasLoadedChats: true,
        });
      },
      loadChatById: async (chatId) => {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`/api/chats/${chatId}`, { headers: authHeaders });

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
          const existingChat = state.chats?.[chatId];
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

        const authHeaders = await getAuthHeaders();
        const response = await fetch(`/api/chats/${chatId}`, {
          method: "PATCH",
          headers: authHeaders,
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

        const authHeaders = await getAuthHeaders();
        await fetch(`/api/chats/${chatId}`, {
          method: "DELETE",
          headers: authHeaders,
        });
      },
      clearAllChats: async () => {
        set({ chats: {}, currentChatId: null, pendingComposerText: null, pendingAttachedDocumentIds: [], pendingWorkflow: null });
        const authHeaders = await getAuthHeaders();
        await fetch("/api/chats", {
          method: "DELETE",
          headers: authHeaders,
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
      setScanStartedAt: (startedAt) =>
        set((state) => (state.scanStartedAt === startedAt ? state : { scanStartedAt: startedAt })),
      setModelDownload: (modelId, download) =>
        set((state) => ({
          modelDownloads: {
            ...state.modelDownloads,
            [modelId]: download,
          },
        })),
      clearModelDownload: (modelId) =>
        set((state) => {
          const next = { ...state.modelDownloads };
          delete next[modelId];
          return { modelDownloads: next };
        }),
    }),
    {
      name: "nextjs-ollama-ui-state",
      storage: {
        getItem: async (name: string) => {
          try {
            const raw = await indexedDBStorage.getItem(name);
            if (raw === null) return null;
            return JSON.parse(raw);
          } catch (err) {
            console.warn("Storage getItem failed (non-critical):", err);
            return null;
          }
        },
        setItem: async (name: string, value: unknown) => {
          try {
            await indexedDBStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            console.warn("Storage setItem failed (non-critical):", err);
          }
        },
        removeItem: async (name: string) => {
          try {
            await indexedDBStorage.removeItem(name);
          } catch (err) {
            console.warn("Storage removeItem failed (non-critical):", err);
          }
        },
      },
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
        defaultJurisdiction: state.defaultJurisdiction,
        autoCleanupConversations: state.autoCleanupConversations,
        scanProgress: state.scanProgress,
        scanningStep: state.scanningStep,
        isScanning: state.isScanning,
        scanStartedAt: state.scanStartedAt,
        modelDownloads: state.modelDownloads,
        customWorkflows: state.customWorkflows,
        pendingWorkflow: state.pendingWorkflow,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<State>;

        return {
          ...currentState,
          cloudMode: (() => {
            if (typeof window !== "undefined") {
              const savedCloudMode = safeStorage.getItem("vaultr-cloud-mode");
              if (savedCloudMode !== null) return savedCloudMode === "true";
              const savedPrivacyMode = safeStorage.getItem("vaultr-privacy-mode");
              if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
            }
            if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
            if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
            return currentState.cloudMode;
          })(),
          usePrivacyMode: (() => {
            if (typeof window !== "undefined") {
              const savedCloudMode = safeStorage.getItem("vaultr-cloud-mode");
              if (savedCloudMode !== null) return savedCloudMode !== "true";
              const savedPrivacyMode = safeStorage.getItem("vaultr-privacy-mode");
              if (savedPrivacyMode !== null) return savedPrivacyMode === "true";
            }
            if (typeof persisted.cloudMode === "boolean") return !persisted.cloudMode;
            if (typeof persisted.usePrivacyMode === "boolean") return persisted.usePrivacyMode;
            return currentState.usePrivacyMode;
          })(),
          selectedModel: (() => {
            const cloudMode = (() => {
              if (typeof window !== "undefined") {
                const savedCloudMode = safeStorage.getItem("vaultr-cloud-mode");
                if (savedCloudMode !== null) return savedCloudMode === "true";
                const savedPrivacyMode = safeStorage.getItem("vaultr-privacy-mode");
                if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
              }
              if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
              if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
              return currentState.cloudMode;
            })();
            if (cloudMode) {
              return persisted.selectedModel && isCloudModel(persisted.selectedModel)
                ? persisted.selectedModel
                : ANTHROPIC_CORE_MODEL;
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
          scanProgress:
            typeof persisted.scanProgress === "number"
              ? persisted.scanProgress
              : currentState.scanProgress,
          scanningStep: persisted.scanningStep || currentState.scanningStep,
          scanResult: currentState.scanResult,
          isScanning:
            typeof persisted.isScanning === "boolean"
              ? persisted.isScanning
              : currentState.isScanning,
          scanStartedAt:
            typeof persisted.scanStartedAt === "number"
              ? persisted.scanStartedAt
              : currentState.scanStartedAt,
          modelDownloads: persisted.modelDownloads || currentState.modelDownloads,
          customWorkflows: Array.isArray(persisted.customWorkflows)
            ? persisted.customWorkflows
            : currentState.customWorkflows,
          pendingWorkflow: persisted.pendingWorkflow || currentState.pendingWorkflow,
          thinkingModeDefault:
            typeof persisted.thinkingModeDefault === "boolean"
              ? persisted.thinkingModeDefault
              : currentState.thinkingModeDefault,
          themePreference:
            (typeof window !== "undefined" &&
              (safeStorage.getItem("vaultr-theme") as
                | "light"
                | "dark"
                | "system"
                | null)) ||
            persisted.themePreference ||
            currentState.themePreference,
          defaultModelPreference: (() => {
            const cloudMode = (() => {
              if (typeof window !== "undefined") {
                const savedCloudMode = safeStorage.getItem("vaultr-cloud-mode");
                if (savedCloudMode !== null) return savedCloudMode === "true";
                const savedPrivacyMode = safeStorage.getItem("vaultr-privacy-mode");
                if (savedPrivacyMode !== null) return savedPrivacyMode !== "true";
              }
              if (typeof persisted.cloudMode === "boolean") return persisted.cloudMode;
              if (typeof persisted.usePrivacyMode === "boolean") return !persisted.usePrivacyMode;
              return currentState.cloudMode;
            })();
            if (cloudMode) return ANTHROPIC_CORE_MODEL;
            const model =
              (typeof window !== "undefined" &&
                safeStorage.getItem("vaultr-default-model")) ||
              persisted.defaultModelPreference ||
              currentState.defaultModelPreference;
            return isLexModel(model) ? model : currentState.defaultModelPreference;
          })(),
          defaultJurisdiction:
            (typeof window !== "undefined" && safeStorage.getItem("vaultr-default-jurisdiction")) ||
            persisted.defaultJurisdiction ||
            currentState.defaultJurisdiction,
          autoCleanupConversations:
            typeof window !== "undefined" &&
            safeStorage.getItem("vaultr-auto-cleanup") !== null
              ? safeStorage.getItem("vaultr-auto-cleanup") === "true"
              : typeof persisted.autoCleanupConversations === "boolean"
              ? persisted.autoCleanupConversations
              : currentState.autoCleanupConversations,
        };
      },
    }
  )
);

export default useChatStore;