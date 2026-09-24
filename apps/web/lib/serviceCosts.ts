// Pure logic for the Services & Costs tracker at /admin/services — every
// external service the site connects to, with what it costs and when it
// renews. No fs here (unit-tested); reads/writes live in serviceCostStore.ts.

export type ServiceCategory = "usage" | "subscription" | "dev" | "free" | "dormant";
export type BillingCycle = "usage" | "monthly" | "yearly" | "free";

export interface ServiceEntry {
  id: string;
  name: string;
  category: ServiceCategory;
  /** What the site uses it for. */
  purpose: string;
  /** Env var names that prove it is wired up (names only — never values). */
  envKeys: string[];
  plan: string;
  /** Cost per billing cycle in USD. For "usage" it is a typical month. */
  cost: number | null;
  billingCycle: BillingCycle;
  /** ISO date (YYYY-MM-DD) of the next renewal/charge, or "". */
  renewalDate: string;
  billingEmail: string;
  /** Where to manage the plan, see invoices, or cancel. */
  dashboardUrl: string;
  /** Where to watch consumption, when the provider has a separate page. */
  usageUrl: string;
  notes: string;
}

export interface ServiceCatalog {
  services: ServiceEntry[];
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  usage: "Usage-billed",
  subscription: "Subscriptions & fixed",
  dev: "Development tools",
  free: "Free / keyless",
  dormant: "Configured but off",
};

export const CATEGORY_ORDER: ServiceCategory[] = ["usage", "subscription", "dev", "free", "dormant"];
export const BILLING_CYCLES: BillingCycle[] = ["usage", "monthly", "yearly", "free"];

const MAX_TEXT = 500;

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isCategory(value: unknown): value is ServiceCategory {
  return CATEGORY_ORDER.includes(value as ServiceCategory);
}

function isCycle(value: unknown): value is BillingCycle {
  return BILLING_CYCLES.includes(value as BillingCycle);
}

/** Parse a user-entered amount ("$19", "4.50") to a non-negative number, or null. */
export function parseCost(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const cleaned = text(value).replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Only http(s) links are rendered as clickable. */
export function safeUrl(value: unknown): string {
  const raw = text(value);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function clampService(raw: unknown): ServiceEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const name = text(item.name, 120);
  if (!name) return null;
  const id = slugify(text(item.id, 60) || name);
  if (!id) return null;
  const renewalDate = text(item.renewalDate, 10);
  const envKeys = Array.isArray(item.envKeys)
    ? item.envKeys.map((key) => text(key, 80)).filter((key) => /^[A-Z0-9_]+$/.test(key))
    : [];
  return {
    id,
    name,
    category: isCategory(item.category) ? item.category : "subscription",
    purpose: text(item.purpose),
    envKeys,
    plan: text(item.plan, 120),
    cost: parseCost(item.cost),
    billingCycle: isCycle(item.billingCycle) ? item.billingCycle : "monthly",
    renewalDate: isIsoDate(renewalDate) ? renewalDate : "",
    billingEmail: text(item.billingEmail, 200),
    dashboardUrl: safeUrl(item.dashboardUrl),
    usageUrl: safeUrl(item.usageUrl),
    notes: text(item.notes, 1000),
  };
}

export function clampCatalog(raw: unknown): ServiceCatalog {
  const list = raw && typeof raw === "object" ? (raw as { services?: unknown }).services : undefined;
  const seen = new Set<string>();
  const services: ServiceEntry[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    const entry = clampService(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    services.push(entry);
  }
  return { services };
}

/** Normalize a cost to a per-month figure; free/unknown costs count as 0. */
export function monthlyEquivalent(entry: Pick<ServiceEntry, "cost" | "billingCycle">): number {
  if (entry.cost === null || entry.billingCycle === "free") return 0;
  return entry.billingCycle === "yearly" ? entry.cost / 12 : entry.cost;
}

export interface CostSummary {
  monthlyTotal: number;
  yearlyTotal: number;
  /** Paid (non-free, non-dormant) services with no cost entered yet. */
  unpricedCount: number;
}

export function summarizeCosts(services: ServiceEntry[]): CostSummary {
  let monthlyTotal = 0;
  let unpricedCount = 0;
  for (const entry of services) {
    if (entry.category === "free" || entry.category === "dormant") continue;
    if (entry.cost === null && entry.billingCycle !== "free") unpricedCount += 1;
    monthlyTotal += monthlyEquivalent(entry);
  }
  monthlyTotal = Math.round(monthlyTotal * 100) / 100;
  return { monthlyTotal, yearlyTotal: Math.round(monthlyTotal * 12 * 100) / 100, unpricedCount };
}

/** Whole days from `today` until the renewal date, or null when unset. */
export function daysUntil(renewalDate: string, today: Date): number | null {
  if (!isIsoDate(renewalDate)) return null;
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(`${renewalDate}T00:00:00Z`) - start) / 86_400_000);
}
