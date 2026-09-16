import { describe, expect, it } from "vitest";
import {
  createMemberBlockReviewToken,
  readMemberBlockReviewToken,
} from "@/lib/memberBlockReviewIdentity";

describe("blocked-member review identity", () => {
  it("round-trips a normalized verified email", async () => {
    const token = await createMemberBlockReviewToken("  Member@Example.COM ");
    await expect(readMemberBlockReviewToken(token)).resolves.toBe("member@example.com");
  });

  it("rejects a tampered token", async () => {
    const token = await createMemberBlockReviewToken("member@example.com");
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    await expect(readMemberBlockReviewToken(tampered)).resolves.toBeNull();
  });
});
