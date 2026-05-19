"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadZone } from "@/components/contract-scanner/upload-zone";
import type { RiskFilter } from "@/components/contract-scanner/results-display";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import useChatStore from "@/app/hooks/useChatStore";
import useContractScannerStore from "@/app/hooks/useContractScannerStore";
import { getRiskCounts } from "@/lib/contract-scanner";
import { GROQ_DEFAULT_MODEL } from "@/lib/models";
import { parseScanReportContent, type ScanReportEntry } from "@/lib/scan-reports";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
  const setScanProgress = useChatStore((state) => state.setScanProgress);
  const setScanningStep = useChatStore((state) => state.setScanningStep);
  const setAnalysis = useChatStore((state) => state.setScanResult);
  const setIsScanning = useChatStore((state) => state.setIsScanning);

  useEffect(() => {
    if (cloudMode || hasForcedCloudMode.current) return;

    hasForcedCloudMode.current = true;
    setCloudMode(true, GROQ_DEFAULT_MODEL);
    // hasForcedCloudMode is a one-shot ref so this Cloud Mode write cannot repeat
    // when the store update changes cloudMode and re-renders the scanner.
  }, [cloudMode, setCloudMode]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const reportId = searchParams.get("report");
    if (!reportId) return;

    const loadReport = async () => {
      const response = await fetch("/api/scan-reports");
      if (!response.ok) {
        setError("Saved report could not be loaded.");
        return;
      }

      const data = (await response.json()) as { reports?: ScanReportEntry[] };
      const report = (data.reports || []).find((entry) => entry.id === reportId);
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
      setActiveFilter("all");
      setError(null);
    };

    loadReport().catch(() => setError("Saved report could not be loaded."));
    // Saved reports are loaded once from the URL; store setters are guarded, so
    // loading a report cannot retrigger when analysis state changes.
  }, [setAnalysis, setError, setFile]);

  useEffect(() => {
    if (!isScanning) {
      setSlowScan(false);
      return;
    }

    const startedAt = Date.now();
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
  }, [isScanning, setScanProgress, setScanningStep]);

  const handleFileSelected = (selectedFile: File) => {
    setAnalysis(null);
    setActiveFilter("all");
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("File too large. Please upload a contract under 10MB.");
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const scanContract = async () => {
    if (!file) return;

    setIsScanning(true);
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
        setError(data?.error || "Lex is unavailable. Check your internet connection and try again.");
        return;
      }

      setAnalysis(data.analysis);
      const counts = getRiskCounts(data.analysis.clauses);
      await fetch("/api/scan-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          created_at: new Date().toISOString(),
          high_count: counts.high,
          medium_count: counts.medium,
          standard_count: counts.standard,
          report_json: JSON.stringify(data.analysis),
        }),
      });
      toast.success("Report saved to Vault", {
        action: {
          label: "Open Vault",
          onClick: () => {
            window.location.href = "/vault";
          },
        },
      });
      setScanProgress(100);
    } catch (error) {
      console.error("Contract scan failed", error);
      setError("Lex is unavailable. Check your internet connection and try again.");
      setScanProgress(0);
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
        <ResultsDisplay
          analysis={analysis}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onReset={() => {
            setActiveFilter("all");
            setAnalysis(null);
            reset();
          }}
        />
      ) : (
        <>
          <div className="px-6 pb-4">
            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--sidebar-bg)] p-3 md:grid-cols-2">
              {[
                {
                  id: "cloud" as ScannerMode,
                  title: "☁️ Cloud Mode",
                  description: "Uses Groq llama-3.3-70b-versatile for fast analysis.",
                  time: "~15 seconds",
                  note: "Processed by Groq. Zero data retention.",
                },
                {
                  id: "private" as ScannerMode,
                  title: "🔒 Private Mode",
                  description: "Uses your currently installed local Ollama model.",
                  time: "~2-5 minutes depending on your model",
                  note: "Your document never leaves your device.",
                },
              ].map((option) => {
                const active = scannerMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setScannerMode(option.id)}
                    className={`rounded-[var(--radius-md)] border p-4 text-left transition-colors ${
                      active
                        ? "border-[#1a1916] bg-[var(--bg)]"
                        : "border-[var(--border)] bg-transparent hover:bg-[var(--surface)]"
                    }`}
                    aria-pressed={active}
                  >
                    <div className="text-sm font-medium text-[var(--text)]">{option.title}</div>
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
