"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateUUID } from "@/lib/utils";
import type { LocalDocument, LocalProject } from "@/lib/local-documents";
import { getFileType } from "@/lib/local-documents";

interface LocalVaultState {
  documents: LocalDocument[];
  projects: LocalProject[];
  addDocuments: (files: File[], projectId?: string | null) => LocalDocument[];
  createProject: (name: string, cmNumber?: string | null, documentIds?: string[]) => LocalProject;
  deleteDocuments: (ids: string[]) => void;
  renameProject: (projectId: string, name: string) => void;
}

const useLocalVaultStore = create<LocalVaultState>()(
  persist(
    (set, get) => ({
      documents: [],
      projects: [],
      addDocuments: (files, projectId = null) => {
        const docs = files.map((file) => ({
          id: generateUUID(),
          filename: file.name,
          fileType: getFileType(file.name),
          sizeBytes: file.size,
          projectId,
          createdAt: new Date().toISOString(),
        }));

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
      renameProject: (projectId, name) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, name } : project
          ),
        }));
      },
    }),
    {
      name: "vaultr-local-vault",
    }
  )
);

export default useLocalVaultStore;
