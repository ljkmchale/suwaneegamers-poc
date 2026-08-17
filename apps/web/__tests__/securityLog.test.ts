import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, isSuspiciousPath } from "@/lib/securityLog";

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
