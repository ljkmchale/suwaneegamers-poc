// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ admin: false, live: vi.fn(() => ({ visitors: [], updatedAt: "now" })) }));
vi.mock("@/lib/adminSession", () => ({ getAdminSession: async () => ({ isAdmin: state.admin }) }));
vi.mock("@/lib/liveAnalytics", () => ({ getLiveAnalytics: state.live }));
import { GET } from "@/app/admin/analytics/live-data/route";

beforeEach(() => { state.admin = false; state.live.mockClear(); });

it("denies non-admin requests before reading presence", async () => {
  const response = await GET(new NextRequest("http://localhost/admin/analytics/live-data?audience=all"));
  expect(response.status).toBe(401);
  expect(state.live).not.toHaveBeenCalled();
});

it("allows administrators to include internal visitors without caching identities", async () => {
  state.admin = true;
  const response = await GET(new NextRequest("http://localhost/admin/analytics/live-data?audience=all"));
  expect(response.status).toBe(200);
  expect(state.live).toHaveBeenCalledWith("all");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
