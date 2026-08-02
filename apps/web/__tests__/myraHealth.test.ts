import { describe, expect, it } from "vitest";
import { calculateOverall, conversationalSummary, type DiagnosticResult } from "@/lib/myraHealth";

const result = (service: string, status: DiagnosticResult["status"]): DiagnosticResult => ({
  service, displayName: service, status, message: `${service} is ${status}`,
  checkedAt: "2026-08-01T12:00:00.000Z",
  userImpact: status === "healthy" ? undefined : `${service} capability is limited.`,
});

describe("Myra health aggregation", () => {
  it("reports healthy when every checked system is healthy", () => {
    expect(calculateOverall([result("database", "healthy"), result("ollama", "healthy")])).toBe("healthy");
  });
  it("reports degraded for a noncritical outage", () => {
    expect(calculateOverall([result("database", "healthy"), result("speaches", "unavailable")])).toBe("degraded");
  });
  it("reports unavailable for a critical outage", () => {
    expect(calculateOverall([result("database", "unavailable"), result("speaches", "healthy")])).toBe("unavailable");
  });
  it("treats a public Cloudflare outage as a critical website outage", () => {
    expect(calculateOverall([result("website", "healthy"), result("cloudflare", "unavailable")])).toBe("unavailable");
  });
  it("handles multiple simultaneous failures and explains impact", () => {
    const diagnostics = [result("database", "healthy"), result("memory", "unavailable"), result("speaches", "unavailable")];
    expect(calculateOverall(diagnostics)).toBe("degraded");
    expect(conversationalSummary("degraded", diagnostics)).toContain("capability is limited");
  });
  it("does not claim health without evidence", () => {
    expect(calculateOverall([])).toBe("unknown");
    expect(conversationalSummary("unknown", [])).toContain("could not verify");
  });
});
