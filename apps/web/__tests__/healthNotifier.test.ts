import { describe, expect, it } from "vitest";
import {
  composeIncidentEmail,
  notifiableTransitions,
  type IncidentTransition,
} from "@/lib/healthNotifier";

const opened: IncidentTransition = {
  kind: "opened",
  service: "cloudflare",
  displayName: "Public website through Cloudflare",
  severity: "critical",
  summary: "The public Suwanee Gamers website is not reachable through Cloudflare.",
  userImpact: "Visitors may be unable to reach the public website.",
  technicalDetails: "HTTP 502",
  startedAt: "2026-08-03T12:00:00.000Z",
};

describe("health notifier", () => {
  it("only forwards critical transitions", () => {
    const warning: IncidentTransition = { ...opened, service: "speaches", severity: "warning" };
    expect(notifiableTransitions([opened, warning]).map((t) => t.service)).toEqual(["cloudflare"]);
  });

  it("composes a DOWN email with impact and details", () => {
    const { subject, text } = composeIncidentEmail(opened);
    expect(subject).toContain("DOWN");
    expect(subject).toContain("Public website through Cloudflare");
    expect(text).toContain("Visitors may be unable to reach the public website.");
    expect(text).toContain("HTTP 502");
  });

  it("composes a RECOVERED email that names both timestamps", () => {
    const resolved: IncidentTransition = {
      ...opened,
      kind: "resolved",
      resolvedAt: "2026-08-03T12:05:00.000Z",
    };
    const { subject, text } = composeIncidentEmail(resolved);
    expect(subject).toContain("RECOVERED");
    expect(text.toLowerCase()).toContain("responding normally again");
  });
});
