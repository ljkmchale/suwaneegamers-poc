import { describe, expect, it } from "vitest";
import { isCanadianSignInPath, mayStartGeoSession } from "@/lib/geoAccess";

describe("Canadian member exception", () => {
  it("allows only the verified approved email to start a Canadian session", () => {
    expect(mayStartGeoSession("CA", true, "EverttDukeshire@gmail.com", true)).toBe(true);
    expect(mayStartGeoSession("CA", true, "EvelynDukeshire@gmail.com", true)).toBe(true);
    expect(mayStartGeoSession("CA", true, "evelyndukeshire@gmail.com", false)).toBe(false);
    expect(mayStartGeoSession("CA", true, "evelyndukeshire@gmial.com", true)).toBe(false);
    expect(mayStartGeoSession("FR", true, "evelyndukeshire@gmail.com", true)).toBe(false);
    expect(mayStartGeoSession("CA", true, "everttdukeshire@gmail.com", false)).toBe(false);
    expect(mayStartGeoSession("CA", true, "other@gmail.com", true)).toBe(false);
    expect(mayStartGeoSession("FR", true, "everttdukeshire@gmail.com", true)).toBe(false);
  });
  it("preserves US and origin behavior", () => {
    expect(mayStartGeoSession("US", true, "other@gmail.com", true)).toBe(true);
    expect(mayStartGeoSession(null, true, "other@gmail.com", true)).toBe(true);
    expect(mayStartGeoSession("CA", false, "other@gmail.com", true)).toBe(true);
  });
  it("opens the authentication round trip without opening member pages", () => {
    for (const path of ["/", "/signin", "/api/auth/google", "/api/auth/google/callback", "/api/auth/discord", "/api/auth/discord/callback"])
      expect(isCanadianSignInPath(path)).toBe(true);
    for (const path of ["/campaigns", "/admin", "/api/brain/admin", "/api/auth/google-fake", "/signin-fake"])
      expect(isCanadianSignInPath(path)).toBe(false);
  });
});
