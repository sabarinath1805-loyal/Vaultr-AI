"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconCloud, IconLock } from "@tabler/icons-react";
import { toast } from "sonner";
import { UploadZone } from "@/components/contract-scanner/upload-zone";
import type { RiskFilter } from "@/components/contract-scanner/results-display";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import useChatStore from "@/app/hooks/useChatStore";
import useContractScannerStore from "@/app/hooks/useContractScannerStore";
import { getRiskCounts } from "@/lib/contract-scanner";
import { CEREBRAS_CORE_MODEL } from "@/lib/models";
import { parseScanReportContent, type ScanReportEntry } from "@/lib/scan-reports";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function validateFile(file: File): string | null {
  const extension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_TYPES.includes(file.type)) {
    return `Only PDF, DOCX, and TXT files are supported. You uploaded a ${extension.toUpperCase()} file.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File is too large. Maximum size is 50MB.";
  }
  return null;
}

function getContractScannerError(error: unknown): string {
  const status = (error as Record<string, unknown>)?.status ?? (error as Record<string, unknown>)?.statusCode;
  if (typeof navigator !== "undefined" && !navigator.onLine) return "No internet connection. Check your network and try again.";
  if (status === 503) return "Lex is under high demand right now. Try again in a moment.";
  if (status === 429) return "Rate limit reached. Try again in a few seconds.";
  if (status === 401 || status === 403) return "Authentication error. Check your API keys in Settings.";
  return "Contract scan failed. Try again or switch to a different mode.";
}
type ScannerMode = "cloud" | "private";
const scanningSteps = [
  "Reading document...",
  "Extracting key clauses...",
  "Reviewing payment terms...",
  "Checking liability provisions...",
  "Scanning termination rights...",
  "Reviewing confidentiality obligations...",
  "Checking dispute resolution clauses...",
  "Analysing governing law...",
  "Reviewing IP ownership...",
  "Checking non-compete provisions...",
  "Scanning indemnification clauses...",
  "Reviewing representations and warranties...",
  "Checking assignment restrictions...",
  "Analysing force majeure provisions...",
  "Reviewing insurance requirements...",
  "Preparing risk assessment...",
];

export default function ContractScannerPage() {
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ filename: string; date: string } | null>(null);
  const [scannerMode, setScannerMode] = useState<ScannerMode>("cloud");
  const [slowScan, setSlowScan] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RiskFilter>("all");
  const hasForcedCloudMode = useRef(false);
  const file = useContractScannerStore((state) => state.file);
  const error = useContractScannerStore((state) => state.error);
  const setFile = useContractScannerStore((state) => state.setFile);
  const setError = useContractScannerStore((state) => state.setError);
  const reset = useContractScannerStore((state) => state.reset);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const setCloudMode = useChatStore((state) => state.setCloudMode);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const defaultModelPreference = useChatStore((state) => state.defaultModelPreference);
  const ollamaUrl = useChatStore((state) => state.ollamaUrl);
  const scanProgress = useChatStore((state) => state.scanProgress);
  const scanningStep = useChatStore((state) => state.scanningStep);
  const analysis = useChatStore((state) => state.scanResult);
  const isScanning = useChatStore((state) => state.isScanning);
  const scanStartedAt = useChatStore((state) => state.scanStartedAt);
  const setScanProgress = useChatStore((state) => state.setScanProgress);
  const setScanningStep = useChatStore((state) => state.setScanningStep);
  const setAnalysis = useChatStore((state) => state.setScanResult);
  const setIsScanning = useChatStore((state) => state.setIsScanning);
  const setScanStartedAt = useChatStore((state) => state.setScanStartedAt);

  useEffect(() => {
    if (cloudMode || hasForcedCloudMode.current) return;

    hasForcedCloudMode.current = true;
    setCloudMode(true, CEREBRAS_CORE_MODEL);
    // hasForcedCloudMode is a one-shot ref so this Cloud Mode write cannot repeat
    // when the store update changes cloudMode and re-renders the scanner.
  }, [cloudMode, setCloudMode]);

  useEffect(() => {
    setReportId(new URLSearchParams(window.location.search).get("report"));
  }, []);

  useEffect(() => {
    if (!reportId) return;

    const loadReport = async () => {
      const response = await fetch(`/api/scan-reports?id=${encodeURIComponent(reportId)}`);
      if (!response.ok) {
        setError("Saved report could not be loaded.");
        return;
      }

      const data = (await response.json()) as { report?: ScanReportEntry };
      const report = data.report;
      if (!report) {
        setError("Saved report not found.");
        return;
      }

      const savedAnalysis = parseScanReportContent(report);
      if (!savedAnalysis) {
        setError("Saved report could not be loaded.");
        return;
      }

      setFile(null);
      setAnalysis(savedAnalysis);
      setReportMeta({ filename: report.filename, date: report.date });
      setActiveFilter("all");
      setError(null);
    };

    loadReport().catch(() => setError("Saved report could not be loaded."));
    // Saved reports are loaded once from the URL; store setters are guarded, so
    // loading a report cannot retrigger when analysis state changes.
  }, [reportId, setAnalysis, setError, setFile]);

  useEffect(() => {
    if (!isScanning) {
      setSlowScan(false);
      return;
    }

    const startedAt = scanStartedAt || Date.now();
    if (!scanStartedAt) setScanStartedAt(startedAt);
    const stepInterval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const stepIndex = Math.floor(elapsed / 6000) % scanningSteps.length;
      setScanningStep(scanningSteps[stepIndex]);
    }, 6000);
    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setScanProgress(Math.min(85, Math.round((elapsed / 60000) * 85)));
      if (elapsed >= 90000) setSlowScan(true);
    }, 500);

    return () => {
      window.clearInterval(stepInterval);
      window.clearInterval(progressInterval);
    };
    // Progress writes are driven only by isScanning. The progress/scanning values
    // being updated are intentionally excluded so the interval cannot recreate itself.
  }, [isScanning, scanStartedAt, setScanProgress, setScanStartedAt, setScanningStep]);

  const handleFileSelected = (selectedFile: File) => {
    setAnalysis(null);
    setActiveFilter("all");
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const scanContract = async () => {
    if (!file) return;

    setIsScanning(true);
    setScanStartedAt(Date.now());
    setError(null);
    setScanningStep(scanningSteps[0]);
    setScanProgress(0);
    setSlowScan(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", scannerMode);
      if (scannerMode === "private") {
        formData.append("model", selectedModel || defaultModelPreference);
        formData.append("ollamaUrl", ollamaUrl);
      }

      const response = await fetch("/api/contract-scanner", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("Contract scan failed", {
          status: response.status,
          body: data,
        });
        setError(data?.error || getContractScannerError({ status: response.status }));
        return;
      }

      setAnalysis(data.analysis);
      const counts = getRiskCounts(Array.isArray(data.analysis?.clauses) ? data.analysis.clauses : []);
      const saveResponse = await fetch("/api/scan-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          created_at: new Date().toISOString(),
          high_count: counts.high,
          medium_count: counts.medium,
          standard_count: counts.standard,
          report_json: JSON.stringify(data.analysis),
          report: data.analysis,
        }),
      });
      if (!saveResponse.ok) {
        const saveError = await saveResponse.json().catch(() => null);
        throw new Error(saveError?.error || "save scan report failed");
      }
      const savedReport = await saveResponse.json();
      window.dispatchEvent(new Event("vaultr-scan-reports-updated"));
      if (savedReport?.duplicate) {
        toast.info("This document is already in your Vault.");
      } else {
        toast.success("Report saved to Vault", {
          action: {
            label: "Open Vault",
            onClick: () => {
              window.location.href = "/vault";
            },
          },
        });
      }
      setReportMeta({ filename: file.name, date: new Date().toISOString() });
      setScanProgress(100);
      setScanStartedAt(null);
    } catch (error) {
      console.error("Contract scan failed", error);
      setError(getContractScannerError(error));
      setScanProgress(0);
      setScanStartedAt(null);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-center justify-between px-6 pb-6 pt-8">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--text)]">
            Contract Scanner
          </h1>
          <p className="mt-2 max-w-[600px] text-sm leading-[1.6] text-[var(--text-muted)]">
            Upload any contract and Lex will identify risks, flag problem clauses, and give you
            negotiation recommendations using Cloud Mode or fully private local analysis.
          </p>
        </div>
      </div>

      {analysis ? (
        <>
          {reportId && (
            <div className="px-6 pb-4">
              <Link
                href="/vault"
                className="text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                ← Back to Vault
              </Link>
            </div>
          )}
          <ResultsDisplay
            analysis={analysis}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            filename={reportMeta?.filename || file?.name}
            reportDate={reportMeta?.date || new Date().toISOString()}
            onReset={() => {
              setActiveFilter("all");
              setAnalysis(null);
              setReportMeta(null);
              reset();
            }}
          />
        </>
      ) : (
        <>
          <div className="px-6 pb-4">
            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--sidebar-bg)] p-3 md:grid-cols-2">
              {[
                {
                  id: "cloud" as ScannerMode,
                  title: "Cloud Mode",
                  icon: IconCloud,
                  description: "Uses Lex Core for fast analysis.",
                  time: "~15 seconds",
                  note: "Processed by Groq. Zero data retention.",
                },
                {
                  id: "private" as ScannerMode,
                  title: "Private Mode",
                  icon: IconLock,
                  description: "Uses your currently installed local Ollama model.",
                  time: "~2-5 minutes depending on your model",
                  note: "Your document never leaves your device.",
                },
              ].map((option) => {
                const active = scannerMode === option.id;
                const ModeIcon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setScannerMode(option.id)}
                    className={`rounded-[var(--radius-md)] border p-4 text-left transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--bg)]"
                        : "border-[var(--border)] bg-transparent hover:bg-[var(--surface)]"
                    }`}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                      <ModeIcon className="h-4 w-4" stroke={1.8} />
                      {option.title}
                    </div>
                    <div className="mt-1 text-[13px] leading-[1.5] text-[var(--text-muted)]">
                      {option.description}
                    </div>
                    <div className="mt-2 text-[12px] font-medium text-[var(--text)]">
                      {option.time}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
              {scannerMode === "private"
                ? "Your document never leaves your device."
                : "Processed by Groq. Zero data retention."}
            </div>
          </div>
          <UploadZone
            file={file}
            error={error}
            isScanning={isScanning}
            scanningMessage={
              slowScan
                ? "Still scanning... large documents can take a few minutes."
                : scanningStep
            }
            scanProgress={scanProgress}
            onFileSelected={handleFileSelected}
            onRemoveFile={() => setFile(null)}
            onScan={scanContract}
          />
        </>
      )}
      {analysis && (
        <div className="px-6 pb-8">
          <Link
            href="/vault"
            className="text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            View saved reports in Vault →
          </Link>
        </div>
      )}
    </main>
  );
}
