import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brain-dm-access-"));
fs.mkdirSync(path.join(vaultRoot, "wiki", "threads"), { recursive: true });
fs.writeFileSync(path.join(vaultRoot, "wiki", "threads", "Secret.md"), "---\nvisibility: dm\n---\n# Secret\n\nThe villain is the innkeeper.");

const admin = vi.hoisted(() => ({ isAdmin: false }));
vi.mock("@/lib/adminSession", () => ({ getAdminSession: async () => ({ isAdmin: admin.isAdmin }) }));
vi.mock("@/lib/brain/config", () => ({ brainConfig: { vaultRoot } }));
vi.mock("@/lib/brain/vector-store", () => ({
  hasIndex: async () => true,
  loadIndex: async () => ({
    pages: {
      "wiki/threads/Secret.md": { path: "wiki/threads/Secret.md", title: "Secret", campaign: "HoE", visibility: "dm" },
    },
  }),
}));

const { GET: getSource } = await import("@/app/api/brain/source/route");
const { GET: resolveSource } = await import("@/app/api/brain/resolve-source/route");
const { grantedVisibility } = await import("@/lib/brain/requestVisibility");

const request = (route: string, params: Record<string, string>) =>
  new NextRequest(`http://localhost${route}?${new URLSearchParams(params)}`);

beforeEach(() => {
  admin.isAdmin = false;
});
afterAll(() => fs.rmSync(vaultRoot, { recursive: true, force: true }));

describe("DM-only Library pages", () => {
  it("a member cannot read one by adding visibility=dm to the address", async () => {
    const response = await getSource(request("/api/brain/source", { path: "wiki/threads/Secret.md", visibility: "dm" }));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain("innkeeper");
  });

  it("a member cannot look one up by name with visibility=dm either", async () => {
    const response = await resolveSource(request("/api/brain/resolve-source", { target: "Secret", visibility: "dm" }));
    expect(response.status).toBe(404);
  });

  it("a signed-in admin still can", async () => {
    admin.isAdmin = true;
    const response = await getSource(request("/api/brain/source", { path: "wiki/threads/Secret.md", visibility: "dm" }));
    expect(response.status).toBe(200);
    expect((await response.json()).markdown).toContain("innkeeper");
    expect((await resolveSource(request("/api/brain/resolve-source", { target: "Secret", visibility: "dm" }))).status).toBe(200);
  });

  it("only grants dm to an admin who asks for it", async () => {
    expect(await grantedVisibility("dm")).toBe("players");
    expect(await grantedVisibility("anything")).toBe("players");
    admin.isAdmin = true;
    expect(await grantedVisibility("dm")).toBe("dm");
    expect(await grantedVisibility(null)).toBe("players");
  });
});
