import { describe, expect, it } from "vitest";
import {
  clampCatalog,
  clampService,
  daysUntil,
  monthlyEquivalent,
  parseCost,
  safeUrl,
  summarizeCosts,
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
