import { describe, expect, it } from "vitest";
import { injectChronicleAnalytics } from "@/lib/chronicleAnalytics";

describe("Chronicle analytics injection", () => {
  it("adds the first-party tracker before the closing body", () => {
    const html = injectChronicleAnalytics("<html><body><main></main></body></html>");

    expect(html).toContain("data-sg-chronicle-analytics");
    expect(html.indexOf("data-sg-chronicle-analytics")).toBeLessThan(html.indexOf("</body>"));
    expect(html).toContain('eventType: "page_view"');
    expect(html).toContain('eventType: "page_engagement"');
    expect(html).toContain('eventType: "scroll_depth"');
    expect(html).toContain('eventType: "content_view"');
    expect(html).toContain('contentType: "chronicle chapter"');
    expect(html).toContain('fetch("/api/analytics/events"');
  });

  it("does not install the tracker twice", () => {
    const once = injectChronicleAnalytics("<body></body>");
    const twice = injectChronicleAnalytics(once);

    expect(twice).toBe(once);
    expect(twice.match(/data-sg-chronicle-analytics/g)).toHaveLength(1);
  });

  it("still tracks an HTML fragment without a closing body", () => {
    expect(injectChronicleAnalytics("<main></main>")).toContain("data-sg-chronicle-analytics");
  });
});
