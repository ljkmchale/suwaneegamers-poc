import { describe, expect, it } from "vitest";
import { createMyraBrainAccessToken, mayUseFullMyraDm, tokenAllowsCampaign, verifyMyraBrainAccessToken } from "@/lib/myraBrainAccess";

describe("Myra DM identity access", () => {
  it("only permits explicitly configured Google emails", () => {
    const allowlist = "larry@example.com";
    expect(mayUseFullMyraDm("Larry@Example.com", allowlist)).toBe(true);
    expect(mayUseFullMyraDm("someone@example.com", allowlist)).toBe(false);
    expect(mayUseFullMyraDm("larry@example.com", "")).toBe(false);
  });

  it("accepts an unmodified, unexpired signed capability", () => {
    const now = Date.parse("2026-08-02T12:00:00Z");
    const token = createMyraBrainAccessToken("google-subject", ["Souls of Destiny"], "test-secret", now);
    const payload = verifyMyraBrainAccessToken(token, "test-secret", now);
    expect(tokenAllowsCampaign(payload, "Souls of Destiny")).toBe(true);
    expect(tokenAllowsCampaign(payload, "Heroes of Emberstran")).toBe(false);
    expect(tokenAllowsCampaign(payload, "All")).toBe(false);
    expect(verifyMyraBrainAccessToken(`${token}x`, "test-secret", now)).toBeNull();
    expect(verifyMyraBrainAccessToken(token, "wrong-secret", now)).toBeNull();
    expect(verifyMyraBrainAccessToken(token, "test-secret", now + 16 * 60 * 1000)).toBeNull();
  });

  it("allows Larry and Chip tokens across campaigns", () => {
    const token = createMyraBrainAccessToken("owner", "*", "test-secret");
    expect(tokenAllowsCampaign(verifyMyraBrainAccessToken(token, "test-secret"), "All")).toBe(true);
  });
});
