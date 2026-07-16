import { describe, expect, it } from "vitest";
import {
  adminAllowlistActive,
  allowedAdminEmails,
  isAllowedAdminEmail,
} from "@/lib/adminAllowlist";

const ENV = "larry.m.mchale@gmail.com,chip.poole@gmail.com";

describe("allowedAdminEmails", () => {
  it("parses, trims, and lowercases the comma-separated list", () => {
    expect(allowedAdminEmails(" Larry.M.McHale@Gmail.com , chip.poole@gmail.com ,")).toEqual([
      "larry.m.mchale@gmail.com",
      "chip.poole@gmail.com",
    ]);
  });

  it("returns empty for unset or blank env", () => {
    expect(allowedAdminEmails(undefined)).toEqual([]);
    expect(allowedAdminEmails("")).toEqual([]);
    expect(allowedAdminEmails(" , ")).toEqual([]);
  });
});

describe("adminAllowlistActive", () => {
  it("is active only when at least one email is configured", () => {
    expect(adminAllowlistActive(ENV)).toBe(true);
    expect(adminAllowlistActive(undefined)).toBe(false);
    expect(adminAllowlistActive("")).toBe(false);
  });
});

describe("isAllowedAdminEmail", () => {
  it("accepts allowlisted emails case-insensitively", () => {
    expect(isAllowedAdminEmail("larry.m.mchale@gmail.com", ENV)).toBe(true);
    expect(isAllowedAdminEmail("Chip.Poole@gmail.com", ENV)).toBe(true);
  });

  it("rejects unknown or missing emails when the list is set", () => {
    expect(isAllowedAdminEmail("stranger@example.com", ENV)).toBe(false);
    expect(isAllowedAdminEmail(undefined, ENV)).toBe(false);
    expect(isAllowedAdminEmail("", ENV)).toBe(false);
  });

  it("allows anyone when the allowlist is not configured", () => {
    expect(isAllowedAdminEmail("stranger@example.com", undefined)).toBe(true);
    expect(isAllowedAdminEmail(undefined, "")).toBe(true);
  });
});
