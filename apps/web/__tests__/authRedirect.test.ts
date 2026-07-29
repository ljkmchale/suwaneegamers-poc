import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/authRedirect";

describe("post-sign-in return path", () => {
  it("keeps a same-site path so a deep link survives sign-in", () => {
    expect(safeReturnPath("/campaigns")).toBe("/campaigns");
    expect(safeReturnPath("/campaigns/mad-mage?tab=sessions")).toBe(
      "/campaigns/mad-mage?tab=sessions",
    );
  });

  it("refuses anything that would leave the site (open-redirect guard)", () => {
    expect(safeReturnPath("//evil.example")).toBe("/");
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("/\\evil.example")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath("campaigns")).toBe("/");
  });

  it("never bounces back to the gate or an API endpoint", () => {
    expect(safeReturnPath("/signin")).toBe("/");
    expect(safeReturnPath("/signin?from=/x")).toBe("/");
    expect(safeReturnPath("/api/calendar/events")).toBe("/");
  });

  it("falls back for empty input, with a caller-chosen default", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath(null, "")).toBe("");
  });
});
