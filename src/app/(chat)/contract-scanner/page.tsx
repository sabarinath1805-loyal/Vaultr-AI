"use client";

import { useEffect, useState } from "react";
import { UploadZone } from "@/components/contract-scanner/upload-zone";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import useChatStore from "@/app/hooks/useChatStore";
import useContractScannerStore from "@/app/hooks/useContractScannerStore";
import { isLexModel } from "@/lib/models";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const scanningSteps = [
  "Reading document...",
  "Analyzing clauses...",
  "Identifying risks...",
  "Checking obligations...",
  "Generating report...",
];

export default function ContractScannerPage() {
  const [scanningStepIndex, setScanningStepIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [slowScan, setSlowScan] = useState(false);
  const file = useContractScannerStore((state) => state.file);
  const analysis = useContractScannerStore((state) => state.analysis);
  const error = useContractScannerStore((state) => state.error);
  const isScanning = useContractScannerStore((state) => state.isScanning);
  const setFile = useContractScannerStore((state) => state.setFile);
  const setAnalysis = useContractScannerStore((state) => state.setAnalysis);
  const setError = useContractScannerStore((state) => state.setError);
  const setIsScanning = useContractScannerStore((state) => state.setIsScanning);
  const reset = useContractScannerStore((state) => state.reset);
  const selectedModel = useChatStore((state) => state.selectedModel);

  useEffect(() => {
    if (!isScanning) {
      setScanningStepIndex(0);
      setScanProgress(0);
      setSlowScan(false);
      return;
    }

    const startedAt = Date.now();
    const stepInterval = window.setInterval(() => {
      setScanningStepIndex((index) => (index + 1) % scanningSteps.length);
    }, 4000);
    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setScanProgress(Math.min(90, Math.round((elapsed / 60000) * 90)));
      if (elapsed >= 90000) setSlowScan(true);
    }, 500);

    return () => {
      window.clearInterval(stepInterval);
      window.clearInterval(progressInterval);
    };
  }, [isScanning]);

  const handleFileSelected = (selectedFile: File) => {
    setAnalysis(null);
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
    if (!isLexModel(selectedModel)) {
      setError("Contract Scanner requires a Lex model. Please install one first.");
      return;
    }

    setIsScanning(true);
    setError(null);
    setScanningStepIndex(0);
    setScanProgress(0);
    setSlowScan(false);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 180000);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedModel) formData.append("selectedModel", selectedModel);

      const response = await fetch("/api/chats", {
        method: "POST",
        body: formData,
        signal: controller.signal,
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
    } catch (error) {
      console.error("Contract scan failed", error);
      setError("Scan failed. Make sure Ollama is running and try again.");
    } finally {
      window.clearTimeout(timeout);
      setIsScanning(false);
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-center justify-between px-6 pb-6 pt-8">
        <div>
          <h1 className="font-display text-[28px] font-normal text-[var(--text)]">
            Contract Scanner
          </h1>
          <p className="mt-2 max-w-[600px] text-sm leading-[1.6] text-[var(--text-muted)]">
            Upload any contract and Lex will identify risks, flag problem clauses, and give you
            negotiation recommendations. 100% local — your documents never leave your device.
          </p>
        </div>
      </div>

      {analysis ? (
        <ResultsDisplay analysis={analysis} onReset={reset} />
      ) : (
        <UploadZone
          file={file}
          error={error}
          isScanning={isScanning}
          scanningMessage={
            slowScan
              ? "Still scanning... large documents can take a few minutes."
              : scanningSteps[scanningStepIndex]
          }
          scanProgress={scanProgress}
          onFileSelected={handleFileSelected}
          onRemoveFile={() => setFile(null)}
          onScan={scanContract}
        />
      )}
    </main>
  );
}
