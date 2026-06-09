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

/**
 * Parse the stored JSON `content` field of a scan-report entry into a `ContractAnalysis`.
 *
 * @param entry - The scan report row (typically loaded from SQLite).
 * @returns A `ContractAnalysis` object, or `null` if the stored content is not valid JSON.
 */
export function parseScanReportContent(entry: ScanReportEntry): ContractAnalysis | null {
  try {
    return JSON.parse(entry.content) as ContractAnalysis;
  } catch {
    return null;
  }
}
