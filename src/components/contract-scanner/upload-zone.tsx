"use client";

import { Upload } from "lucide-react";

interface UploadZoneProps {
  file: File | null;
  error: string | null;
  isScanning: boolean;
  onFileSelected: (file: File) => void;
  onScan: () => void;
}

function formatFileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function UploadZone({
  file,
  error,
  isScanning,
  onFileSelected,
  onScan,
}: UploadZoneProps) {
  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (selected) onFileSelected(selected);
  };

  return (
    <div className="px-6">
      {error && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[rgb(229,62,62)] bg-[rgb(255,240,240)] px-4 py-3 text-[13px] text-[rgb(197,48,48)]">
          {error}
        </div>
      )}

      {!file ? (
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
          className="block cursor-pointer rounded-[var(--radius-md)] border-[1.5px] border-dashed border-[var(--border)] bg-[var(--sidebar-bg)] p-12 text-center"
        >
          <Upload className="mx-auto mb-4 h-6 w-6 text-[var(--text-muted)]" />
          <div className="text-sm text-[var(--text-muted)]">
            Drop your contract here or click to upload
          </div>
          <div className="mt-1 text-xs text-[var(--text-faint)]">
            Supports PDF, DOCX, and TXT — stays on your device
          </div>
          <input
            data-testid="contract-file-input"
            type="file"
            accept=".pdf,.docx,.txt"
            className="sr-only"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
          <div className="text-sm font-medium text-[var(--text)]">{file.name}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {formatFileSize(file.size)}
          </div>
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning}
            className="mt-5 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-[var(--bg)] transition-[background-color] duration-150 hover:bg-[rgb(51,51,51)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isScanning ? (
              <>
                <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-[var(--bg)] border-t-transparent" />
                Scanning...
              </>
            ) : (
              "Scan Contract →"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
