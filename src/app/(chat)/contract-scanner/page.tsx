"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadZone } from "@/components/contract-scanner/upload-zone";
import type { RiskFilter } from "@/components/contract-scanner/results-display";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import useChatStore from "@/app/hooks/useChatStore";
import useContractScannerStore from "@/app/hooks/useContractScannerStore";
import { getRiskCounts } from "@/lib/contract-scanner";
import { GROQ_DEFAULT_MODEL, isLexModel, sortModelsByLexOrder } from "@/lib/models";
import { parseScanReportContent, type ScanReportEntry } from "@/lib/scan-reports";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
  const [slowScan, setSlowScan] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RiskFilter>("all");
  const [forcedCloudFromPrivate, setForcedCloudFromPrivate] = useState(false);
  const [allowPrivateAfterScan, setAllowPrivateAfterScan] = useState(false);
  const file = useContractScannerStore((state) => state.file);
  const error = useContractScannerStore((state) => state.error);
  const setFile = useContractScannerStore((state) => state.setFile);
  const setError = useContractScannerStore((state) => state.setError);
  const reset = useContractScannerStore((state) => state.reset);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const cloudMode = useChatStore((state) => state.cloudMode);
  const setCloudMode = useChatStore((state) => state.setCloudMode);
  const scanProgress = useChatStore((state) => state.scanProgress);
  const scanningStep = useChatStore((state) => state.scanningStep);
  const analysis = useChatStore((state) => state.scanResult);
  const isScanning = useChatStore((state) => state.isScanning);
  const setScanProgress = useChatStore((state) => state.setScanProgress);
  const setScanningStep = useChatStore((state) => state.setScanningStep);
  const setAnalysis = useChatStore((state) => state.setScanResult);
  const setIsScanning = useChatStore((state) => state.setIsScanning);

  useEffect(() => {
    if (!cloudMode && !allowPrivateAfterScan) {
      setForcedCloudFromPrivate(true);
      setCloudMode(true, GROQ_DEFAULT_MODEL);
    }
  }, [allowPrivateAfterScan, cloudMode, setCloudMode]);

  const switchBackToPrivate = async () => {
    let privateModel = isLexModel(selectedModel) ? selectedModel : null;
    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const modelIds = Array.isArray(data?.models)
          ? data.models.map(({ name }: { name: string }) => name)
          : [];
        privateModel = sortModelsByLexOrder(modelIds.filter(isLexModel))[0] || privateModel;
      }
    } catch {
      privateModel = privateModel || null;
    }
    setAllowPrivateAfterScan(true);
    setCloudMode(false, privateModel);
    setForcedCloudFromPrivate(false);
  };

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
    const modelToUse = GROQ_DEFAULT_MODEL;

    setIsScanning(true);
    setError(null);
    setScanningStep(scanningSteps[0]);
    setScanProgress(0);
    setSlowScan(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("selectedModel", modelToUse);

      const response = await fetch("/api/chats", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("Contract scan failed", {
          status: response.status,
          body: data,
        });
        setError("Scan failed. Make sure Ollama is running and try again.");
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
      setError("Scan failed. Make sure Ollama is running and try again.");
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
            negotiation recommendations using Cloud Mode for faster, more accurate analysis.
          </p>
        </div>
      </div>

      <div className="mx-6 mb-5 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--color-background-warning)] px-4 py-3 text-sm text-[var(--color-text-warning)]">
        Contract Scanner uses Cloud Mode for faster, more accurate analysis. Switch to Private Mode after scanning if needed.
      </div>

      {analysis && (
        <div className="mx-6 mb-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-sm text-[var(--text)]">
          <span className="flex-1">Scan complete.</span>
          <button
            type="button"
            onClick={() => setForcedCloudFromPrivate(false)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[13px]"
          >
            Stay in Cloud
          </button>
          {forcedCloudFromPrivate && (
            <button
              type="button"
              onClick={switchBackToPrivate}
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] text-[var(--bg-primary)]"
            >
              Switch back to Private
            </button>
          )}
        </div>
      )}

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
