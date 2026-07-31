import { describe, expect, it } from "vitest";
import { classifySecurityActors, overallThreatLevel } from "@/lib/securityClassifier";

const now = new Date("2026-07-30T12:00:00.000Z").getTime();
const event = (
  minutesAgo: number,
  kind: "failed_login" | "admin_request" | "suspicious_request",
  ip = "203.0.113.10",
  path = "/admin",
) => ({
  createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  kind,
  ip,
  path,
  userAgent: "Mozilla/5.0 Chrome/150",
});

describe("security actor classification", () => {
  it("recognizes an isolated browser login mistake as a likely normal person", () => {
    const [actor] = classifySecurityActors([event(2, "failed_login")], now);
    expect(actor.level).toBe("normal");
    expect(actor.label).toBe("Likely normal person");
  });

  it("labels known vulnerability paths as background scanner noise", () => {
    const [actor] = classifySecurityActors([
      event(2, "suspicious_request", "198.51.100.2", "/wp-admin/install.php"),
    ], now);
    expect(actor.level).toBe("scanner");
  });

  it("raises a high-confidence alert for a login burst", () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      event(index, "failed_login", "198.51.100.3"),
    );
    const [actor] = classifySecurityActors(events, now);
    expect(actor.level).toBe("attack");
    expect(overallThreatLevel([actor])).toBe("attack");
  });

  it("does not call local verification traffic an attack", () => {
    const events = Array.from({ length: 40 }, (_, index) =>
      event(index % 10, "admin_request", "::1"),
    );
    expect(classifySecurityActors(events, now)[0].level).toBe("system");
  });
});
