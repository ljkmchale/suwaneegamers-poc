import { describe, expect, it } from "vitest";
import {
  clampCatalog,
  clampService,
  daysUntil,
  monthlyEquivalent,
  parseCents,
  parseCost,
  recentMonths,
  regularChargesDue,
  safeUrl,
  summarizeCosts,
  totalsByMonth,
  type ServiceEntry,
} from "@/lib/serviceCosts";

function entry(overrides: Partial<ServiceEntry>): ServiceEntry {
  return clampService({ name: "Svc", ...overrides }) as ServiceEntry;
}

describe("serviceCosts", () => {
  it("parses user-entered amounts", () => {
    expect(parseCost("$1,019.50")).toBe(1019.5);
    expect(parseCost("")).toBeNull();
    expect(parseCost("-4")).toBeNull();
    expect(parseCost("abc")).toBeNull();
    expect(parseCost(19)).toBe(19);
  });

  it("only keeps http(s) links", () => {
    expect(safeUrl("https://elevenlabs.io/app/usage")).toBe("https://elevenlabs.io/app/usage");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("not a url")).toBe("");
  });

  it("clamps entries and drops bad fields", () => {
    const service = clampService({
      name: "  ElevenLabs ",
      category: "bogus",
      billingCycle: "weekly",
      renewalDate: "soon",
      envKeys: ["ELEVEN_API_KEY", "lower_case", 5],
      usageUrl: "ftp://x",
    });
    expect(service).toMatchObject({
      id: "elevenlabs",
      name: "ElevenLabs",
      category: "subscription",
      billingCycle: "monthly",
      renewalDate: "",
      envKeys: ["ELEVEN_API_KEY"],
      usageUrl: "",
    });
    expect(clampService({ name: "" })).toBeNull();
  });

  it("dedupes catalog ids", () => {
    const catalog = clampCatalog({ services: [{ name: "A" }, { name: "a" }, null, { name: "B" }] });
    expect(catalog.services.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("totals known costs, with yearly plans at one-twelfth", () => {
    const services = [
      entry({ name: "Migadu", category: "subscription", cost: 24, billingCycle: "yearly" }),
      entry({ name: "Eleven", category: "usage", cost: 5, billingCycle: "monthly" }),
      entry({ name: "Jina", category: "usage", cost: null, billingCycle: "usage" }),
      entry({ name: "Free", category: "free", cost: 0, billingCycle: "free" }),
      entry({ name: "Off", category: "dormant", cost: 50, billingCycle: "monthly" }),
      entry({ name: "Suno", category: "excluded", cost: 10, billingCycle: "monthly" }),
      entry({ name: "Unpriced ref", category: "excluded", cost: null, billingCycle: "monthly" }),
    ];
    expect(monthlyEquivalent(services[0])).toBe(2);
    expect(summarizeCosts(services)).toEqual({ monthlyTotal: 7, yearlyTotal: 84, unpricedCount: 1 });
  });

  it("counts days until renewal", () => {
    const today = new Date(2026, 8, 24);
    expect(daysUntil("2026-09-30", today)).toBe(6);
    expect(daysUntil("2026-09-20", today)).toBe(-4);
    expect(daysUntil("", today)).toBeNull();
  });
});

describe("payment log helpers", () => {
  it("converts amounts to cents", () => {
    expect(parseCents("$22")).toBe(2200);
    expect(parseCents("19.99")).toBe(1999);
    expect(parseCents("")).toBeNull();
  });

  it("lists recent months newest first across a year boundary", () => {
    expect(recentMonths(new Date(2026, 0, 15), 3)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });

  it("totals payments by month", () => {
    const totals = totalsByMonth(
      [
        { paidOn: "2026-09-03", amountCents: 2200 },
        { paidOn: "2026-09-10", amountCents: 2000 },
        { paidOn: "2026-08-03", amountCents: 2200 },
        { paidOn: "2025-01-01", amountCents: 999 },
      ],
      ["2026-09", "2026-08", "2026-07"],
    );
    expect(totals).toEqual([
      { month: "2026-09", totalCents: 4200, count: 2 },
      { month: "2026-08", totalCents: 2200, count: 1 },
      { month: "2026-07", totalCents: 0, count: 0 },
    ]);
  });

  it("finds regular charges not yet logged this month", () => {
    const services = [
      entry({ name: "Eleven", category: "subscription", cost: 22, billingCycle: "monthly" }),
      entry({ name: "Claude", category: "dev", cost: 20, billingCycle: "monthly" }),
      entry({ name: "Domain", category: "subscription", cost: 20, billingCycle: "yearly", renewalDate: "2026-09-30" }),
      entry({ name: "Other domain", category: "subscription", cost: 20, billingCycle: "yearly", renewalDate: "2027-02-01" }),
      entry({ name: "Credits", category: "usage", cost: 4, billingCycle: "usage" }),
      entry({ name: "Suno", category: "excluded", cost: 10, billingCycle: "monthly" }),
      entry({ name: "Unpriced", category: "subscription", cost: null, billingCycle: "monthly" }),
    ];
    const due = regularChargesDue(services, "2026-09", new Set(["claude"]));
    expect(due.map((s) => s.id)).toEqual(["eleven", "domain"]);
  });
});
