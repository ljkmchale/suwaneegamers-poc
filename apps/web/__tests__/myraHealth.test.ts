import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateOverall, cloudflareWebsiteCheck, conversationalSummary, type DiagnosticResult } from "@/lib/myraHealth";

const result = (service: string, status: DiagnosticResult["status"]): DiagnosticResult => ({
  service, displayName: service, status, message: `${service} is ${status}`,
  checkedAt: "2026-08-01T12:00:00.000Z",
  userImpact: status === "healthy" ? undefined : `${service} capability is limited.`,
});

describe("Myra health aggregation", () => {
  it("reports healthy when every checked system is healthy", () => {
    expect(calculateOverall([result("database", "healthy"), result("anthropic", "healthy")])).toBe("healthy");
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

  it("folds uptime and a recent recovery into the healthy answer", () => {
    const spoken = conversationalSummary("healthy", [result("database", "healthy")], {
      uptimeSeconds: 2 * 86_400,
      now: Date.parse("2026-08-03T18:00:00.000Z"),
      incidents: [
        {
          id: "i1", service: "cloudflare", startedAt: "2026-08-03T09:00:00.000Z",
          resolvedAt: "2026-08-03T09:05:00.000Z", status: "resolved", severity: "critical",
          summary: "Public website through Cloudflare recovered automatically.",
        },
      ],
    });
    expect(spoken).toContain("2 days");
    expect(spoken.toLowerCase()).toContain("recovered on its own");
  });

  it("says how long an active outage has been going", () => {
    const spoken = conversationalSummary("unavailable", [result("cloudflare", "unavailable")], {
      now: Date.parse("2026-08-03T12:20:00.000Z"),
      incidents: [
        {
          id: "i2", service: "cloudflare", startedAt: "2026-08-03T12:00:00.000Z",
          status: "active", severity: "critical",
          summary: "The public website is not reachable.",
        },
      ],
    });
    expect(spoken).toContain("20 minutes ago");
  });
});

describe("Cloudflare health confirmation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("absorbs a brief probe failure before it can create an incident", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "cf-ray": "test-ray" } }));

    const result = await cloudflareWebsiteCheck();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("healthy");
  });

  it("returns an unavailable result promptly when the outage is sustained", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("bad gateway", { status: 502 }));

    const result = await cloudflareWebsiteCheck();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("unavailable");
    expect(result.errorCode).toBe("HTTP_502");
    expect(result.technicalDetails).toContain("after 2 probes");
  });
});
