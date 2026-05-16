"use client";

import { Brain, FileText, Shield, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

interface UploadZoneProps {
  file: File | null;
  error: string | null;
  isScanning: boolean;
  scanningMessage: string;
  scanProgress: number;
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
  scanningMessage,
  scanProgress,
  onFileSelected,
  onRemoveFile,
  onScan,
}: UploadZoneProps) {
  const router = useRouter();
  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (selected) onFileSelected(selected);
  };

  return (
    <div className="space-y-6 px-6 pb-8">
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-3 text-[13px] text-[var(--danger-hover)]">
          <div>{error}</div>
          {error.includes("requires a Lex model") && (
            <button
              type="button"
              onClick={() => router.push("/models")}
              className="mt-3 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-[var(--bg-primary)] hover:opacity-80"
            >
              → Install a Lex Model
            </button>
          )}
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
              <h2 className="font-display text-[28px] font-normal text-[var(--text)]">{title}</h2>
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
        <div className={`rounded-[var(--radius-lg)] border bg-[var(--bg)] p-6 ${
          error ? "border-[var(--danger)]" : "border-[var(--border)]"
        }`}>
          <div className="flex items-center gap-3">
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
          {error && (
            <div className="mt-4 text-[13px] text-[var(--danger)]">
              {error}
            </div>
          )}
          {isScanning && (
            <div className="mt-5 space-y-2">
              <div className="text-[13px] text-[var(--text-muted)]">{scanningMessage}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full bg-[#1a1916] transition-[width] duration-500 ease-out"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={onScan}
              disabled={isScanning}
              className="inline-flex items-center rounded-[8px] bg-[#1a1916] px-6 py-2.5 text-[14px] font-medium text-[#ffffff] transition-[background-color] duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScanning ? (
                <>
                  <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-[#ffffff] border-t-transparent" />
                  {scanningMessage}
                </>
              ) : error ? (
                "Retry"
              ) : (
                "Scan Contract →"
              )}
            </button>
            {onRemoveFile && (
              <button
                type="button"
                onClick={onRemoveFile}
                className="text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
