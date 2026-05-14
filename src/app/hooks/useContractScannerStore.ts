import type { ContractAnalysis } from "@/lib/contract-scanner";
import { create } from "zustand";

interface ContractScannerState {
  file: File | null;
  analysis: ContractAnalysis | null;
  error: string | null;
  isScanning: boolean;
  setFile: (file: File | null) => void;
  setAnalysis: (analysis: ContractAnalysis | null) => void;
  setError: (error: string | null) => void;
  setIsScanning: (isScanning: boolean) => void;
  reset: () => void;
}

const useContractScannerStore = create<ContractScannerState>()((set) => ({
  file: null,
  analysis: null,
  error: null,
  isScanning: false,
  setFile: (file) => set({ file }),
  setAnalysis: (analysis) => set({ analysis }),
  setError: (error) => set({ error }),
  setIsScanning: (isScanning) => set({ isScanning }),
  reset: () => set({ file: null, analysis: null, error: null, isScanning: false }),
}));

export default useContractScannerStore;
