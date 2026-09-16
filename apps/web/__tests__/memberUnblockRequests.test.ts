// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testContentDir = mkdtempSync(join(tmpdir(), "sg-member-unblock-"));

beforeAll(() => {
  process.env.SUWANEE_CONTENT_DIR = testContentDir;
});

afterAll(async () => {
  const { getDb } = await import("@/lib/db");
  getDb().close();
  delete (globalThis as typeof globalThis & { __sgDb?: unknown }).__sgDb;
  delete process.env.SUWANEE_CONTENT_DIR;
  rmSync(testContentDir, { recursive: true, force: true });
});

describe("member unblock requests", () => {
  it("supports a single review for each block decision", async () => {
    const { blockMember, isMemberBlocked, unblockMember } = await import("@/lib/memberBlocks");
    const {
      getMemberUnblockRequest,
      requestMemberUnblock,
      resolveMemberUnblockRequest,
    } = await import("@/lib/memberUnblockRequests");

    blockMember({ email: "Member@Example.com", reason: "Internal reason" });
    expect(isMemberBlocked("member@example.com")).toBe(true);

    requestMemberUnblock("member@example.com", "Please review my access.");
    expect(getMemberUnblockRequest("member@example.com")).toMatchObject({
      status: "pending",
      message: "Please review my access.",
    });

    resolveMemberUnblockRequest("member@example.com", "declined", "admin@example.com");
    requestMemberUnblock("member@example.com", "Repeated request");
    expect(getMemberUnblockRequest("member@example.com")).toMatchObject({
      status: "declined",
      message: "Please review my access.",
    });

    blockMember({ email: "member@example.com", reason: "A new restriction" });
    expect(getMemberUnblockRequest("member@example.com")).toBeNull();

    requestMemberUnblock("member@example.com");
    unblockMember("member@example.com");
    resolveMemberUnblockRequest("member@example.com", "approved", "admin@example.com");
    expect(isMemberBlocked("member@example.com")).toBe(false);
    expect(getMemberUnblockRequest("member@example.com")?.status).toBe("approved");
  });
});
