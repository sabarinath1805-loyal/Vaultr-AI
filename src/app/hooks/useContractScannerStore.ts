import { create } from "zustand";

interface ContractScannerState {
  file: File | null;
  error: string | null;
  setFile: (file: File | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const useContractScannerStore = create<ContractScannerState>()((set) => ({
  file: null,
  error: null,
  setFile: (file) => set({ file }),
  setError: (error) => set({ error }),
  reset: () => set({ file: null, error: null }),
}));

export default useContractScannerStore;
