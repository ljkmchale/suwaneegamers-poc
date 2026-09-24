// Pure logic for the Services & Costs tracker at /admin/services — every
// external service the site connects to, with what it costs and when it
// renews. No fs here (unit-tested); reads/writes live in serviceCostStore.ts.

export type ServiceCategory = "usage" | "subscription" | "dev" | "free" | "dormant" | "excluded";
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
  excluded: "Not counted",
};

export const CATEGORY_ORDER: ServiceCategory[] = ["usage", "subscription", "dev", "free", "dormant", "excluded"];
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

/** Categories left out of the totals: no bill, no longer billing, or listed for reference only. */
const UNCOUNTED: ServiceCategory[] = ["free", "dormant", "excluded"];

/** Normalize a cost to a per-month figure; free/unknown costs count as 0. */
export function monthlyEquivalent(entry: Pick<ServiceEntry, "cost" | "billingCycle">): number {
  if (entry.cost === null || entry.billingCycle === "free") return 0;
  return entry.billingCycle === "yearly" ? entry.cost / 12 : entry.cost;
}

export interface CostSummary {
  monthlyTotal: number;
  yearlyTotal: number;
  /** Paid (counted) services with no cost entered yet. */
  unpricedCount: number;
}

export function summarizeCosts(services: ServiceEntry[]): CostSummary {
  let monthlyTotal = 0;
  let unpricedCount = 0;
  for (const entry of services) {
    if (UNCOUNTED.includes(entry.category)) continue;
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

// --- Payment log helpers (the service_payments table) -----------------------

/** Parse a user-entered amount to whole cents, or null. */
export function parseCents(value: unknown): number | null {
  const dollars = parseCost(value);
  return dollars === null ? null : Math.round(dollars * 100);
}

/** "YYYY-MM" for a local date. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The last `count` month keys ending with the month of `today`, newest first. */
export function recentMonths(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    monthKey(new Date(today.getFullYear(), today.getMonth() - index, 1)),
  );
}

export interface MonthTotal {
  month: string;
  totalCents: number;
  count: number;
}

/** Sum payments into the given months (payments outside them are ignored). */
export function totalsByMonth(
  payments: { paidOn: string; amountCents: number }[],
  months: string[],
): MonthTotal[] {
  const totals = new Map(months.map((month) => [month, { month, totalCents: 0, count: 0 }]));
  for (const payment of payments) {
    const bucket = totals.get(payment.paidOn.slice(0, 7));
    if (!bucket) continue;
    bucket.totalCents += payment.amountCents;
    bucket.count += 1;
  }
  return months.map((month) => totals.get(month)!);
}

/**
 * Fixed charges expected in `month` ("YYYY-MM") that have not been logged yet:
 * counted monthly plans with a price, plus yearly plans renewing that month.
 * Usage-billed services (prepaid credit, top-ups) are logged by hand.
 */
export function regularChargesDue(
  services: ServiceEntry[],
  month: string,
  loggedServiceIds: Set<string>,
): ServiceEntry[] {
  return services.filter((entry) => {
    if (entry.category === "free" || entry.category === "dormant" || entry.category === "excluded") return false;
    if (!entry.cost || loggedServiceIds.has(entry.id)) return false;
    if (entry.billingCycle === "monthly") return true;
    return entry.billingCycle === "yearly" && entry.renewalDate.slice(0, 7) === month;
  });
}

/**
 * Next charge date for a monthly plan: the last logged payment's day of month,
 * rolled forward to the first date after `today` (clamped to short months).
 */
export function nextMonthlyCharge(lastPaidOn: string, today: Date): string | null {
  if (!isIsoDate(lastPaidOn)) return null;
  const [year, month, day] = lastPaidOn.split("-").map(Number);
  const todayKey = `${monthKey(today)}-${String(today.getDate()).padStart(2, "0")}`;
  for (let offset = 1; offset <= 36; offset += 1) {
    const first = new Date(year, month - 1 + offset, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const candidate = `${monthKey(first)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    if (candidate > todayKey) return candidate;
  }
  return null;
}

export interface UpcomingCharge {
  entry: ServiceEntry;
  date: string;
}

/**
 * Upcoming charges for counted services, soonest first: monthly plans from
 * their last logged payment, yearly plans from their renewal date.
 */
export function upcomingCharges(
  services: ServiceEntry[],
  lastPaidOn: Map<string, string>,
  today: Date,
): UpcomingCharge[] {
  const charges: UpcomingCharge[] = [];
  for (const entry of services) {
    if (entry.category === "free" || entry.category === "dormant" || entry.category === "excluded") continue;
    if (entry.billingCycle === "monthly") {
      const last = lastPaidOn.get(entry.id);
      const date = last ? nextMonthlyCharge(last, today) : null;
      if (date) charges.push({ entry, date });
    } else if (entry.renewalDate && (daysUntil(entry.renewalDate, today) ?? -1) >= 0) {
      charges.push({ entry, date: entry.renewalDate });
    }
  }
  return charges.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
