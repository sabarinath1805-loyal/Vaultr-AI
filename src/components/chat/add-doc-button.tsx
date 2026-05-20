"use client";

import { useRef, useState } from "react";
import { LayoutGridIcon, Loader2Icon, PlusIcon, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useLocalVaultStore from "@/app/hooks/useLocalVaultStore";
import type { LocalDocument } from "@/lib/local-documents";

interface AddDocButtonProps {
  onSelectDoc: (doc: LocalDocument) => void;
  onBrowseAll: () => void;
  selectedDocIds?: string[];
}

export function AddDocButton({
  onSelectDoc,
  onBrowseAll,
  selectedDocIds = [],
}: AddDocButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDocuments = useLocalVaultStore((state) => state.addDocuments);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    addDocuments(files).forEach(onSelectDoc);
    setUploading(false);
    event.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-[10px] py-[6px] text-sm transition-colors ${
              selectedDocIds.length > 0
                ? "text-[var(--text)] hover:bg-[var(--surface)]"
                : "text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]"
            } ${isOpen ? "bg-[var(--surface)]" : ""}`}
            title="Add documents"
            aria-label="Add documents"
          >
            {selectedDocIds.length > 0 ? (
              <span className="font-medium tabular-nums">{selectedDocIds.length}</span>
            ) : (
              <PlusIcon
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-[135deg]" : ""
                }`}
              />
            )}
            <span className="hidden sm:inline">
              {selectedDocIds.length === 1 ? "Document" : "Documents"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-50 w-44" side="bottom" align="start">
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={uploading}
            onSelect={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}
          >
            {uploading ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin text-[var(--text-faint)]" />
            ) : (
              <Upload className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
            )}
            <span className="text-sm">{uploading ? "Uploading..." : "Upload files"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={onBrowseAll}>
            <LayoutGridIcon className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm">Browse all</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
