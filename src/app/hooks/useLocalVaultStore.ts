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
      name: "vaultr-local-vault",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        documents: state.documents.map(({ content, dataUrl, ...document }) => document),
        projects: state.projects,
      }),
    }
  )
);

export default useLocalVaultStore;

const safeLocalStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
      window.localStorage.removeItem(name);
      window.dispatchEvent(new Event("vaultr-local-storage-quota-cleared"));
    }
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}
