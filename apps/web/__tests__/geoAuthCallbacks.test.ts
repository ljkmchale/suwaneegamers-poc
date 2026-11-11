import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(), record: vi.fn(), blocked: vi.fn(() => false),
  seal: vi.fn(async () => "sealed-test-session"),
}));
vi.mock("iron-session", () => ({ sealData: mocks.seal }));
vi.mock("@/lib/googleOAuth", () => ({ exchangeCodeForIdentity: mocks.exchange,
  getBaseUrl: () => "https://suwaneegamers.net", getRedirectUri: () => "https://suwaneegamers.net/callback", isGoogleAuthConfigured: () => true }));
vi.mock("@/lib/discordOAuth", () => ({ exchangeCodeForIdentity: mocks.exchange,
  getRedirectUri: () => "https://suwaneegamers.net/callback", isDiscordAuthConfigured: () => true }));
vi.mock("@/lib/oauthShared", () => ({ getOAuthBaseUrl: () => "https://suwaneegamers.net" }));
vi.mock("@/lib/securityLog", () => ({ clientIpFromHeaders: () => "203.0.113.10" }));
vi.mock("@/lib/cloudflareSecurity", () => ({ isVerifiedCloudflareRequest: () => true }));
vi.mock("@/lib/memberSignins", () => ({ recordMemberSignin: mocks.record }));
vi.mock("@/lib/memberBlocks", () => ({ isMemberBlocked: mocks.blocked }));
vi.mock("@/lib/memberBlockReviewIdentity", () => ({ createMemberBlockReviewToken: async () => "review",
  MEMBER_BLOCK_REVIEW_COOKIE: "review", MEMBER_BLOCK_REVIEW_TTL_SECONDS: 60 }));

import { GET as google } from "@/app/api/auth/google/callback/route";
import { GET as discord } from "@/app/api/auth/discord/callback/route";

describe.each([["google", google], ["discord", discord]] as const)("%s Canadian authentication", (provider, callback) => {
  beforeEach(() => { vi.clearAllMocks(); mocks.blocked.mockReturnValue(false); });
  function request() {
    return new NextRequest(`https://suwaneegamers.net/api/auth/${provider}/callback?code=test&state=test`, {
      headers: { cookie: "sg-oauth-state=test", "cf-ipcountry": "CA" },
    });
  }
  it.each(["everttdukeshire@gmail.com", "evelyndukeshire@gmail.com"])("issues a session to approved verified %s", async (email) => {
    mocks.exchange.mockResolvedValue({ sub: "123", id: "123", email, emailVerified: true, name: "Member" });
    const response = await callback(request());
    expect(response.status).toBe(307);
    expect(response.cookies.get("sg-user")?.value).toBe("sealed-test-session");
    expect(mocks.record).toHaveBeenCalledOnce();
  });
  it.each([["other@gmail.com", true], ["everttdukeshire@gmail.com", false], ["evelyndukeshire@gmail.com", false], ["evelyndukeshire@gmial.com", true]])("denies %s verified=%s without issuing a session", async (email, emailVerified) => {
    mocks.exchange.mockResolvedValue({ sub: "123", id: "123", email, emailVerified });
    const response = await callback(request());
    expect(response.status).toBe(403);
    expect(response.cookies.get("sg-user")).toBeUndefined();
    expect(mocks.seal).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("still enforces member blocks for the approved identity", async () => {
    mocks.exchange.mockResolvedValue({ email: "everttdukeshire@gmail.com", emailVerified: true });
    mocks.blocked.mockReturnValue(true);
    const response = await callback(request());
    expect(response.cookies.get("sg-auth-error")?.value).toBe("blocked");
    expect(mocks.seal).not.toHaveBeenCalled();
  });
});
