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

export function readMatters(): Matter[] {
  try {
    const saved = window.localStorage.getItem(MATTERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function writeMatters(matters: Matter[]) {
  window.localStorage.setItem(MATTERS_STORAGE_KEY, JSON.stringify(matters));
}

export function readMatterLinks(matterId: string): MatterLinks {
  try {
    const saved = window.localStorage.getItem(MATTER_LINKS_STORAGE_KEY);
    const allLinks = saved ? JSON.parse(saved) : {};
    return allLinks[matterId] || { documents: [], chats: [], scans: [] };
  } catch {
    return { documents: [], chats: [], scans: [] };
  }
}

export function writeMatterLinks(matterId: string, links: MatterLinks) {
  const saved = window.localStorage.getItem(MATTER_LINKS_STORAGE_KEY);
  const allLinks = saved ? JSON.parse(saved) : {};
  window.localStorage.setItem(
    MATTER_LINKS_STORAGE_KEY,
    JSON.stringify({ ...allLinks, [matterId]: links })
  );
}
