export type ChatMessageRole = "user" | "assistant";

export interface ChatAttachment {
  name?: string;
  contentType?: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt?: Date;
  experimental_attachments?: ChatAttachment[];
  attachedDocuments?: {
    id: string;
    filename: string;
    fileType: string | null;
    sizeBytes: number;
  }[];
  agentMode?: boolean;
}

export interface ChatRequestOptions {
  body?: Record<string, unknown>;
}
