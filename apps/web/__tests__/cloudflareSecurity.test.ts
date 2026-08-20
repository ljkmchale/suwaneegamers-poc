import { describe, expect, it } from "vitest";
import { isBlockableSourceIp, isPublicIp, isVerifiedCloudflareRequest } from "@/lib/cloudflareSecurity";

describe("Cloudflare security safeguards", () => {
  it("accepts public IPv4 and IPv6 addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });

  it("refuses local, private, malformed, and unknown addresses", () => {
    for (const ip of ["127.0.0.1", "192.168.1.2", "172.16.0.4", "10.0.0.2", "::1", "fd00::1", "Unknown IP", ""]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("refuses Cloudflare's shared cross-zone Worker source", () => {
    expect(isPublicIp("2a06:98c0:3600::103")).toBe(true);
    expect(isBlockableSourceIp("2a06:98c0:3600::103")).toBe(false);
  });

  it("only trusts client identity when both Cloudflare headers are present", () => {
    expect(isVerifiedCloudflareRequest(new Headers({ "cf-ray": "abc", "cf-connecting-ip": "8.8.8.8" }))).toBe(true);
    expect(isVerifiedCloudflareRequest(new Headers({ "cf-connecting-ip": "8.8.8.8" }))).toBe(false);
  });
});
