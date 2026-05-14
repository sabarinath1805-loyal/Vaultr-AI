"use client";

import { Brain, FileText, Shield, Upload, X } from "lucide-react";

interface UploadZoneProps {
  file: File | null;
  error: string | null;
  isScanning: boolean;
  onFileSelected: (file: File) => void;
  onRemoveFile?: () => void;
  onScan: () => void;
}

function formatFileSize(size: number) {
  return `${Math.max(size / 1024 / 1024, 0.01).toFixed(2)} MB`;
}

const steps = [
  {
    icon: Upload,
    title: "Upload Your Contract",
    description: "PDF, DOCX, or TXT. Stays on your device.",
  },
  {
    icon: Brain,
    title: "Lex Analyses It",
    description: "Lex reads every clause and identifies risks.",
  },
  {
    icon: Shield,
    title: "Get Your Risk Report",
    description: "HIGH, MEDIUM, LOW ratings with recommendations.",
  },
];

export function UploadZone({
  file,
  error,
  isScanning,
  onFileSelected,
  onRemoveFile,
  onScan,
}: UploadZoneProps) {
  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (selected) onFileSelected(selected);
  };

  return (
    <div className="space-y-6 px-6 pb-8">
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[rgb(229,62,62)] bg-[rgb(255,240,240)] px-4 py-3 text-[13px] text-[rgb(197,48,48)]">
          {error}
        </div>
      )}

      {!file && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-bg)] p-5 text-center"
            >
              <Icon className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">{description}</p>
            </article>
          ))}
        </div>
      )}

      {!file ? (
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border-[1.5px] border-dashed border-[var(--border)] bg-[var(--sidebar-bg)] p-12 text-center transition-colors hover:bg-[var(--surface)]"
        >
          <Upload className="h-8 w-8 text-[var(--text-muted)]" />
          <div className="mt-3 text-sm text-[var(--text)]">
            Drop your contract here or click to upload
          </div>
          <div className="mt-1 text-xs text-[var(--text-faint)]">
            PDF, DOCX, TXT · Max 10MB · Stays on your device
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {[
              "PDF",
              "DOCX",
              "TXT",
            ].map((type) => (
              <span
                key={type}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
              >
                {type}
              </span>
            ))}
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
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)]">
                <FileText className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--text)]">{file.name}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatFileSize(file.size)} · {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onScan}
                disabled={isScanning}
                className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-white transition-[background-color] duration-150 hover:bg-[rgb(51,51,51)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isScanning ? (
                  <>
                    <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    Scanning...
                  </>
                ) : (
                  "Scan Contract →"
                )}
              </button>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={onRemoveFile}
                  className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
