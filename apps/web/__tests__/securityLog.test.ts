import { describe, expect, it } from "vitest";
import { automaticBlockDecision, clientIpFromHeaders, immediateBlockReason, isSuspiciousPath } from "@/lib/securityLog";

describe("isSuspiciousPath", () => {
  it("flags common vulnerability-scanner probes", () => {
    for (const path of [
      "/wp-login.php",
      "/wp-admin/setup-config.php",
      "/xmlrpc.php",
      "/phpmyadmin/index.php",
      "/.env",
      "/.git/config",
      "/cgi-bin/test",
      "/config.php",
      "/backup.sql",
      "/vendor/phpunit/whatever",
      "/api/.env",
      "/id_rsa.key",
      "/setup",
      "/install/",
    ]) {
      expect(isSuspiciousPath(path), path).toBe(true);
    }
  });

  it("ignores normal site paths", () => {
    for (const path of [
      "/",
      "/campaigns",
      "/campaigns/mad-mage",
      "/gazetteer",
      "/advents_of_harmony",
      "/admin",
      "/admin/login",
      "/api/calendar/events",
      "/world",
    ]) {
      expect(isSuspiciousPath(path), path).toBe(false);
    }
  });
});

describe("automaticBlockDecision", () => {
  const now = new Date("2026-08-20T12:00:00.000Z").getTime();
  const event = (minutesAgo: number, kind: "failed_login" | "suspicious_request", path: string) => ({
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(), kind, path,
  });

  it("blocks only after a high-confidence threshold", () => {
    expect(automaticBlockDecision(Array.from({ length: 4 }, (_, i) => event(i, "failed_login", "/admin/login")), now).shouldBlock).toBe(false);
    expect(automaticBlockDecision(Array.from({ length: 5 }, (_, i) => event(i, "failed_login", "/admin/login")), now).shouldBlock).toBe(true);
  });

  it("requires distinct vulnerability targets for the one-hour scanner threshold", () => {
    const repeated = Array.from({ length: 15 }, (_, i) => event(20 + i, "suspicious_request", "/probe.php"));
    const distinct = Array.from({ length: 15 }, (_, i) => event(20 + i, "suspicious_request", `/probe-${i}.php`));
    expect(automaticBlockDecision(repeated, now).shouldBlock).toBe(false);
    expect(automaticBlockDecision(distinct, now).shouldBlock).toBe(true);
  });

  it("immediately blocks credential, installer, shell, and suspicious write attempts", () => {
    expect(immediateBlockReason("/.env.production", "GET")).toContain("credential");
    expect(immediateBlockReason("/wp-admin/setup-config.php", "GET")).toContain("installer");
    expect(immediateBlockReason("/setup", "GET")).toContain("installer");
    expect(immediateBlockReason("/install/", "GET")).toContain("installer");
    expect(immediateBlockReason("/shell.php", "GET")).toContain("shell");
    expect(immediateBlockReason("/backup.sql", "POST")).toContain("write attempt");
    expect(automaticBlockDecision([event(59, "suspicious_request", "/.aws/credentials")], now).shouldBlock).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers Cloudflare's cf-connecting-ip", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.1");
  });

  it("returns null when no proxy headers exist", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
