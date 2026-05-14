"use client";

import { UploadZone } from "@/components/contract-scanner/upload-zone";
import { ResultsDisplay } from "@/components/contract-scanner/results-display";
import useChatStore from "@/app/hooks/useChatStore";
import useContractScannerStore from "@/app/hooks/useContractScannerStore";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ContractScannerPage() {
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
          onFileSelected={handleFileSelected}
          onRemoveFile={() => setFile(null)}
          onScan={scanContract}
        />
      )}
    </main>
  );
}
