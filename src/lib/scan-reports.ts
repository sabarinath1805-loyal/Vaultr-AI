import type { ContractAnalysis } from "@/lib/contract-scanner";

export const SCAN_REPORTS_STORAGE_KEY = "vaultr-scan-reports";

export interface ScanReportEntry {
  id: string;
  title: string;
  type: "scan_report";
  date: string;
  content: string;
  filename: string;
}

export function getStoredScanReports(): ScanReportEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SCAN_REPORTS_STORAGE_KEY) || "[]"
    );
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is ScanReportEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        typeof entry.title === "string" &&
        entry.type === "scan_report" &&
        typeof entry.date === "string" &&
        typeof entry.content === "string" &&
        typeof entry.filename === "string"
    );
  } catch {
    return [];
  }
}

export function parseScanReportContent(entry: ScanReportEntry): ContractAnalysis | null {
  try {
    return JSON.parse(entry.content) as ContractAnalysis;
  } catch {
    return null;
  }
}

export function saveScanReport(filename: string, scanResult: ContractAnalysis) {
  if (typeof window === "undefined") return null;

  const vaultEntry: ScanReportEntry = {
    id: crypto.randomUUID(),
    title: `Scan: ${filename}`,
    type: "scan_report",
    date: new Date().toISOString(),
    content: JSON.stringify(scanResult),
    filename,
  };
  const existing = getStoredScanReports();
  existing.unshift(vaultEntry);
  window.localStorage.setItem(SCAN_REPORTS_STORAGE_KEY, JSON.stringify(existing));

  return vaultEntry;
}
