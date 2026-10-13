// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  isMemberBlocked: vi.fn(),
  hasIndex: vi.fn(),
  retrieve: vi.fn(),
  answerQuestion: vi.fn(),
}));

vi.mock("@/lib/userSession", () => ({
  getUserSession: mocks.getUserSession,
  isSignedIn: (session: { email?: string }) => Boolean(session.email),
}));
vi.mock("@/lib/memberBlocks", () => ({ isMemberBlocked: mocks.isMemberBlocked }));
vi.mock("@/lib/brain/vector-store", () => ({ hasIndex: mocks.hasIndex }));
vi.mock("@/lib/brain/query", () => ({ retrieve: mocks.retrieve, answerQuestion: mocks.answerQuestion }));
vi.mock("@/lib/brain/config", () => ({ brainConfig: { topK: 5 } }));
vi.mock("@/lib/adminSession", () => ({ getAdminSession: async () => ({ isAdmin: false }) }));

import { POST } from "@/app/api/brain/ask/route";

function request(body: Record<string, unknown> = {}, bearer?: string) {
  return new NextRequest("http://localhost/api/brain/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ question: "What happened?", ...body }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("LIVEKIT_API_SECRET", "test-machine-secret");
  mocks.getUserSession.mockResolvedValue({ email: "member@example.com" });
  mocks.isMemberBlocked.mockReturnValue(false);
  mocks.hasIndex.mockResolvedValue(true);
  mocks.retrieve.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllEnvs());

describe("Chronicles question authorization", () => {
  it.each([{}, { retrieveOnly: true }, { mode: "retrieve" }])(
    "rejects an existing blocked session before accessing knowledge: %j",
    async (body) => {
      mocks.isMemberBlocked.mockReturnValue(true);
      const response = await POST(request(body));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Access revoked." });
      expect(mocks.isMemberBlocked).toHaveBeenCalledWith("member@example.com");
      expect(mocks.hasIndex).not.toHaveBeenCalled();
      expect(mocks.retrieve).not.toHaveBeenCalled();
      expect(mocks.answerQuestion).not.toHaveBeenCalled();
    },
  );

  it("rejects anonymous callers", async () => {
    mocks.getUserSession.mockResolvedValue({});
    expect((await POST(request())).status).toBe(401);
    expect(mocks.hasIndex).not.toHaveBeenCalled();
  });

  it("allows an unblocked member to retrieve knowledge", async () => {
    expect((await POST(request({ retrieveOnly: true }))).status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalled();
  });

  it("preserves authenticated machine access without a browser session", async () => {
    expect((await POST(request({ retrieveOnly: true }, "test-machine-secret"))).status).toBe(200);
    expect(mocks.getUserSession).not.toHaveBeenCalled();
    expect(mocks.isMemberBlocked).not.toHaveBeenCalled();
    expect(mocks.retrieve).toHaveBeenCalled();
  });

  it("does not let an invalid machine token bypass a member block", async () => {
    mocks.isMemberBlocked.mockReturnValue(true);
    expect((await POST(request({ retrieveOnly: true }, "wrong-secret"))).status).toBe(403);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
});
