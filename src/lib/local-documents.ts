export interface LocalDocument {
  id: string;
  filename: string;
  fileType: string | null;
  sizeBytes: number;
  createdAt: string;
  projectId: string | null;
  content?: string;
  dataUrl?: string;
}

export interface LocalVault {
  documents: LocalDocument[];
  projects: LocalProject[];
}

export interface LocalProject {
  id: string;
  name: string;
  cmNumber: string | null;
  documentIds: string[];
  createdAt: string;
}

export function getFileType(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(bytes / 1024, 1).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
