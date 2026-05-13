"use client";

import { useState } from "react";
import { UploadZone } from "@/components/contract-scanner/upload-zone";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import type { ContractAnalysis } from "@/lib/contract-scanner";
import useChatStore from "@/app/hooks/useChatStore";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ContractScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const selectedModel = useChatStore((state) => state.selectedModel);

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

    setIsScanning(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (selectedModel) formData.append("selectedModel", selectedModel);

    const response = await fetch("/api/chats", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    setIsScanning(false);

    if (!response.ok) {
      setError(data.error || "Lex returned an unexpected response. Please try again.");
      return;
    }

    setAnalysis(data.analysis);
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg)]">
      <h1 className="px-6 pb-4 pt-8 text-lg font-semibold text-[var(--text)]">
        Contract Scanner
      </h1>
      <p className="px-6 pb-6 text-[13px] text-[var(--text-muted)]">
        Upload a contract and Lex will identify risks, flag problem clauses, and
        give you negotiation recommendations. 100% local.
      </p>

      {analysis ? (
        <ResultsDisplay analysis={analysis} onReset={reset} />
      ) : (
        <UploadZone
          file={file}
          error={error}
          isScanning={isScanning}
          onFileSelected={handleFileSelected}
          onScan={scanContract}
        />
      )}
    </main>
  );
}
