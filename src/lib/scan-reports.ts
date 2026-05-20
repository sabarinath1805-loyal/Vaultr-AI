import type { ContractAnalysis } from "@/lib/contract-scanner";

export interface ScanReportEntry {
  id: string;
  title: string;
  type: "scan_report";
  date: string;
  content: string;
  filename: string;
  overallRisk?: string;
  highCount?: number;
  mediumCount?: number;
  standardCount?: number;
}

export function parseScanReportContent(entry: ScanReportEntry): ContractAnalysis | null {
  try {
    return JSON.parse(entry.content) as ContractAnalysis;
  } catch {
    return null;
  }
}
