"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generateUUID } from "@/lib/utils";
import type { LocalDocument, LocalProject } from "@/lib/local-documents";
import { getFileType } from "@/lib/local-documents";
import { toast } from "sonner";

interface LocalVaultState {
  documents: LocalDocument[];
  projects: LocalProject[];
  addDocuments: (files: File[], projectId?: string | null) => LocalDocument[];
  createProject: (name: string, cmNumber?: string | null, documentIds?: string[]) => LocalProject;
  deleteDocuments: (ids: string[]) => void;
  deleteDocument: (id: string) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, name: string) => void;
  attachDocumentsToProject: (projectId: string, files: File[]) => LocalDocument[];
}

const LOCAL_VAULT_STORAGE_KEY = "vaultr-local-vault";
const emptyPersistedVault = JSON.stringify({
  state: { documents: [], projects: [] },
  version: 1,
});

let vaultHasHydrated = false;

const useLocalVaultStore = create<LocalVaultState>()(
  persist(
    (set, get) => ({
      documents: [],
      projects: [],
      addDocuments: (files, projectId = null) => {
        const existingFilenames = new Set(
          get().documents.map((doc) => doc.filename.toLowerCase())
        );
        const uniqueFiles = files.filter((file) => {
          const filename = file.name.toLowerCase();
          if (existingFilenames.has(filename)) {
            toast.info("This document is already in your Vault.");
            return false;
          }
          existingFilenames.add(filename);
          return true;
        });

        const docs = uniqueFiles.map((file) => ({
          id: generateUUID(),
          filename: file.name,
          fileType: getFileType(file.name),
          sizeBytes: file.size,
          projectId,
          createdAt: new Date().toISOString(),
        }));

        uniqueFiles.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            set((state) => ({
              documents: state.documents.map((doc) =>
                doc.id === docs[index].id
                  ? { ...doc, dataUrl: result, content: result.split(",")[1] || "" }
                  : doc
              ),
            }));
          };
          reader.readAsDataURL(file);
        });

        if (docs.length > 0) {
          set((state) => ({
            documents: [...docs, ...state.documents],
            projects: projectId
              ? state.projects.map((project) =>
                  project.id === projectId
                    ? {
                        ...project,
                        documentIds: Array.from(
                          new Set([...project.documentIds, ...docs.map((doc) => doc.id)])
                        ),
                      }
                    : project
                )
              : state.projects,
          }));
        }

        return docs;
      },
      createProject: (name, cmNumber = null, documentIds = []) => {
        const project = {
          id: generateUUID(),
          name,
          cmNumber,
          documentIds,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          projects: [project, ...state.projects],
          documents: state.documents.map((doc) =>
            documentIds.includes(doc.id) ? { ...doc, projectId: project.id } : doc
          ),
        }));

        return project;
      },
      deleteDocuments: (ids) => {
        const deleted = new Set(ids);
        set((state) => ({
          documents: state.documents.filter((doc) => !deleted.has(doc.id)),
          projects: state.projects.map((project) => ({
            ...project,
            documentIds: project.documentIds.filter((id) => !deleted.has(id)),
          })),
        }));
      },
      deleteDocument: (id) => get().deleteDocuments([id]),
      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          documents: state.documents.map((doc) =>
            doc.projectId === projectId ? { ...doc, projectId: null } : doc
          ),
        }));
      },
      renameProject: (projectId, name) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, name } : project
          ),
        }));
      },
      attachDocumentsToProject: (projectId, files) => get().addDocuments(files, projectId),
    }),
    {
      name: LOCAL_VAULT_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => sqliteVaultStorage),
      partialize: (state) => ({
        documents: state.documents,
        projects: state.projects,
      }),
    }
  )
);

export default useLocalVaultStore;

export async function rehydrateLocalVaultSafely() {
  try {
    await useLocalVaultStore.persist.rehydrate();
  } catch {
    await resetLocalVaultPersistence();
  } finally {
    vaultHasHydrated = true;
  }
}

async function resetLocalVaultPersistence() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_VAULT_STORAGE_KEY);
    }
    await sqliteVaultStorage.setItem(LOCAL_VAULT_STORAGE_KEY, emptyPersistedVault);
  } finally {
    useLocalVaultStore.setState({ documents: [], projects: [] });
  }
}

const sqliteVaultStorage = {
  getItem: async (name: string) => {
    if (typeof window === "undefined") return null;
    try {
      const response = await fetch("/api/local-vault", { cache: "no-store" });
      if (!response.ok) throw new Error("Local vault unavailable");
      const data = (await response.json()) as {
        documents?: LocalDocument[];
        projects?: LocalProject[];
      };
      const documents = Array.isArray(data.documents) ? data.documents : [];
      const projects = Array.isArray(data.projects) ? data.projects : [];
      if (documents.length > 0 || projects.length > 0) {
        window.localStorage.removeItem(name);
        return JSON.stringify({ state: { documents, projects }, version: 1 });
      }
    } catch {
      return null;
    }

    return migrateLegacyLocalStorageVault(name);
  },
  setItem: async (_name: string, value: string) => {
    if (typeof window === "undefined") return;
    if (!vaultHasHydrated) return;
    try {
      const parsed = JSON.parse(value) as {
        state?: { documents?: LocalDocument[]; projects?: LocalProject[] };
      };
      await fetch("/api/local-vault", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: Array.isArray(parsed.state?.documents) ? parsed.state.documents : [],
          projects: Array.isArray(parsed.state?.projects) ? parsed.state.projects : [],
        }),
      });
    } catch {
      return;
    }
  },
  removeItem: async (name: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
    await fetch("/api/local-vault", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: [], projects: [] }),
    }).catch(() => undefined);
  },
};

function migrateLegacyLocalStorageVault(name: string) {
  const legacyValue = window.localStorage.getItem(name);
  if (!legacyValue) return null;

  try {
    const parsed = JSON.parse(legacyValue) as {
      state?: { documents?: LocalDocument[]; projects?: LocalProject[] };
      version?: number;
    };
    const documents = Array.isArray(parsed.state?.documents) ? parsed.state.documents : [];
    const projects = Array.isArray(parsed.state?.projects) ? parsed.state.projects : [];
    const nextValue = JSON.stringify({ state: { documents, projects }, version: 1 });
    void sqliteVaultStorage.setItem(name, nextValue);
    window.localStorage.removeItem(name);
    return nextValue;
  } catch {
    window.localStorage.removeItem(name);
    return emptyPersistedVault;
  }
}
