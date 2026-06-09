import { safeStorage } from "@/lib/safe-storage";

export interface Matter {
  id: string;
  name: string;
  client: string;
  type: "Litigation" | "Corporate" | "Real Estate" | "Employment" | "Finance" | "Other";
  status: "Active" | "On Hold" | "Closed";
  createdAt: string;
}

export const MATTER_TYPES: Matter["type"][] = [
  "Litigation",
  "Corporate",
  "Real Estate",
  "Employment",
  "Finance",
  "Other",
];

export const MATTER_STATUSES: Matter["status"][] = ["Active", "On Hold", "Closed"];
export const MATTERS_STORAGE_KEY = "vaultr-matters";
export const MATTER_LINKS_STORAGE_KEY = "vaultr-matter-links";

export interface MatterLinks {
  documents: string[];
  chats: string[];
  scans: string[];
}

/**
 * Read the matter list from `localStorage` (with in-memory fallback via `safeStorage`).
 *
 * @returns The parsed `Matter[]` array, or `[]` if nothing is stored or the stored JSON is malformed.
 */
export function readMatters(): Matter[] {
  try {
    const saved = safeStorage.getItem(MATTERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the matter list to `localStorage` as a JSON string.
 *
 * @param matters - The full matter array to write (replaces the entire stored list).
 */
export function writeMatters(matters: Matter[]) {
  safeStorage.setItem(MATTERS_STORAGE_KEY, JSON.stringify(matters));
}

/**
 * Read the links (documents, chats, scans) associated with a single matter.
 *
 * @param matterId - The matter id to look up.
 * @returns A `MatterLinks` object with empty arrays as defaults. Returns the default object if no links are stored.
 */
export function readMatterLinks(matterId: string): MatterLinks {
  try {
    const saved = safeStorage.getItem(MATTER_LINKS_STORAGE_KEY);
    const allLinks = saved ? JSON.parse(saved) : {};
    return allLinks[matterId] || { documents: [], chats: [], scans: [] };
  } catch {
    return { documents: [], chats: [], scans: [] };
  }
}

/**
 * Persist the links for a single matter, preserving the links of all other matters.
 *
 * @param matterId - The matter id to update.
 * @param links - The new `MatterLinks` object. Overwrites any previously stored links for this matter.
 */
export function writeMatterLinks(matterId: string, links: MatterLinks) {
  const saved = safeStorage.getItem(MATTER_LINKS_STORAGE_KEY);
  const allLinks = saved ? JSON.parse(saved) : {};
  safeStorage.setItem(
    MATTER_LINKS_STORAGE_KEY,
    JSON.stringify({ ...allLinks, [matterId]: links })
  );
}
