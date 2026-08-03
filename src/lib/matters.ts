import { safeStorage } from "@/lib/safe-storage";

/* ------------------------------------------------------------------ */
/*  Core types                                                         */
/* ------------------------------------------------------------------ */

export interface KeyDate {
  id: string;
  label: string;
  date: string; // ISO string
  description: string;
}

export interface Party {
  id: string;
  name: string;
  role: "Claimant" | "Defendant" | "Counsel" | "Judge" | "Witness" | "Other";
  organisation: string;
  email: string;
  phone: string;
}

export interface MatterNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEntry {
  id: string;
  date: string;
  description: string;
  hours: number;
  rate: number; // SGD
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  type: "document" | "chat" | "scan" | "note" | "date" | "status" | "party" | "billing" | "summary" | "export";
  description: string;
}

export const MATTER_STATUS_WORKFLOW = [
  "Active",
  "In Hearing",
  "Judgment Received",
  "Closed",
  "Archived",
] as const;

export type MatterStatus = (typeof MATTER_STATUS_WORKFLOW)[number];

export interface Matter {
  id: string;
  name: string;
  client: string;
  type: "Litigation" | "Corporate" | "Real Estate" | "Employment" | "Finance" | "Other";
  status: MatterStatus;
  createdAt: string;
  jurisdiction?: string;
  practiceArea?: string;
  keyDates: KeyDate[];
  parties: Party[];
  notes: MatterNote[];
  tags: string[];
  relatedMatters: string[];
  billingEntries: BillingEntry[];
  summary: string;
  timeline: TimelineEntry[];
}

export const MATTER_TYPES: Matter["type"][] = [
  "Litigation",
  "Corporate",
  "Real Estate",
  "Employment",
  "Finance",
  "Other",
];

export const MATTER_STATUSES: MatterStatus[] = [...MATTER_STATUS_WORKFLOW];
export const MATTERS_STORAGE_KEY = "vaultr-matters";
export const MATTER_LINKS_STORAGE_KEY = "vaultr-matter-links";

export const PARTY_ROLES: Party["role"][] = [
  "Claimant",
  "Defendant",
  "Counsel",
  "Judge",
  "Witness",
  "Other",
];

export interface MatterLinks {
  documents: string[];
  chats: string[];
  scans: string[];
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const MATTER_DEFAULTS: Pick<
  Matter,
  "keyDates" | "parties" | "notes" | "tags" | "relatedMatters" | "billingEntries" | "summary" | "timeline"
> = {
  keyDates: [],
  parties: [],
  notes: [],
  tags: [],
  relatedMatters: [],
  billingEntries: [],
  summary: "",
  timeline: [],
};

/** Hydrate a stored matter with v2 default fields so older records work. */
export function hydrateMatter(raw: Partial<Matter> & { id: string; name: string }): Matter {
  return { ...MATTER_DEFAULTS, client: "", type: "Other", status: "Active", createdAt: new Date().toISOString(), ...raw } as Matter;
}

/* ------------------------------------------------------------------ */
/*  CRUD helpers                                                       */
/* ------------------------------------------------------------------ */

export function readMatters(): Matter[] {
  try {
    const saved = safeStorage.getItem(MATTERS_STORAGE_KEY);
    const parsed: Partial<Matter>[] = saved ? JSON.parse(saved) : [];
    return parsed.map((m) => hydrateMatter(m as Partial<Matter> & { id: string; name: string }));
  } catch {
    return [];
  }
}

/** Persist the complete local matter list. */
export function writeMatters(matters: Matter[]) {
  safeStorage.setItem(MATTERS_STORAGE_KEY, JSON.stringify(matters));
}

/** Read document, chat, and scan links associated with a matter. */
export function readMatterLinks(matterId: string): MatterLinks {
  try {
    const saved = safeStorage.getItem(MATTER_LINKS_STORAGE_KEY);
    const allLinks = saved ? JSON.parse(saved) : {};
    return allLinks[matterId] || { documents: [], chats: [], scans: [] };
  } catch {
    return { documents: [], chats: [], scans: [] };
  }
}

/** Persist the linked resources for a matter. */
export function writeMatterLinks(matterId: string, links: MatterLinks) {
  const saved = safeStorage.getItem(MATTER_LINKS_STORAGE_KEY);
  const allLinks = saved ? JSON.parse(saved) : {};
  safeStorage.setItem(
    MATTER_LINKS_STORAGE_KEY,
    JSON.stringify({ ...allLinks, [matterId]: links })
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline helpers                                                   */
/* ------------------------------------------------------------------ */

export function addTimelineEntry(
  matter: Matter,
  type: TimelineEntry["type"],
  description: string
): Matter {
  const entry: TimelineEntry = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    description,
  };
  return { ...matter, timeline: [entry, ...matter.timeline] };
}

/** Replace one matter in a list and persist the resulting list. */
export function persistMatterUpdate(matters: Matter[], updated: Matter): Matter[] {
  const next = matters.map((m) => (m.id === updated.id ? updated : m));
  writeMatters(next);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Billing helpers                                                    */
/* ------------------------------------------------------------------ */

export function totalBillingFees(entries: BillingEntry[]): number {
  return entries.reduce((sum, e) => sum + e.hours * e.rate, 0);
}

/** Sum billable hours across a matter's billing entries. */
export function totalBillingHours(entries: BillingEntry[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

/** Render billing entries and totals as CSV text for export. */
export function billingToCSV(entries: BillingEntry[], matterName: string, currency = "USD"): string {
  const header = `Date,Description,Hours,Rate (${currency}),Amount (${currency})`;
  const rows = entries.map(
    (e) => `"${e.date}","${e.description.replace(/"/g, '""')}",${e.hours},${e.rate},${(e.hours * e.rate).toFixed(2)}`
  );
  const total = totalBillingFees(entries);
  rows.push(`"","Total","${totalBillingHours(entries)}","","${total.toFixed(2)}"`);
  return `${matterName} — Billing Summary\n${header}\n${rows.join("\n")}`;
}

/* ------------------------------------------------------------------ */
/*  Key dates helpers                                                  */
/* ------------------------------------------------------------------ */

export function getUpcomingDatesCount(matter: Matter): number {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return matter.keyDates.filter((d) => {
    const date = new Date(d.date);
    return date >= now && date <= sevenDaysFromNow;
  }).length;
}

/** Count matter dates that have passed as of the current time. */
export function getOverdueDatesCount(matter: Matter): number {
  const now = new Date();
  return matter.keyDates.filter((d) => new Date(d.date) < now).length;
}
