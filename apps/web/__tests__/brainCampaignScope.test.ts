import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => {
  const page = (campaign: string, number: number, visibility = "players") => ({
    title: `${campaign} Session ${number} - Recorded Events`,
    path: `wiki/sessions/${campaign}/${number}.md`, campaign, visibility, links: [], backlinks: [],
  });
  const pages = [page("A New Adventure", 34), page("A New Adventure", 99, "dm"), page("SoD", 15)];
  const items = pages.map((p, i) => ({id: String(i), text: ["Ridley struck the beast.", "Secret DM plan.", "Lila returned to town."][i], embedding: [],
    metadata: {path: p.path, campaign: p.campaign, visibility: p.visibility, chunkIndex: 0}}));
  return { index: { pages: Object.fromEntries(pages.map(p => [p.path, p])), items },
    search: vi.fn(() => []), chat: vi.fn(async () => "An answer.") };
});
vi.mock("@/lib/brain/vector-store", () => ({ loadIndex: async () => fixtures.index, searchIndex: fixtures.search }));
vi.mock("@/lib/brain/ai-client", () => ({ embedTexts: async () => [[1]], chat: fixtures.chat, chatStream: vi.fn() }));
vi.mock("@/lib/brain/query-cache", () => ({ lookupCache: async () => null, storeCache: vi.fn() }));
import { answerQuestion, retrieve } from "@/lib/brain/query";

beforeEach(() => vi.clearAllMocks());
describe("campaign-scoped retrieval", () => {
  it.each(["A New Adventure", "ANA", "ana"])("selects the player-safe ANA latest session for %s", async campaign => {
    const result = await answerQuestion("What is the latest session?", { campaign });
    expect(result.answer).toContain("Session 34");
    expect(result.answer).not.toContain("Session 99");
    expect(result.sources.map(source => source.campaign)).toEqual(["A New Adventure"]);
    expect(fixtures.chat).not.toHaveBeenCalled();
  });
  it("recognizes a spoken ANA alias", async () => {
    const result = await answerQuestion("What is the latest session in ANA?");
    expect(result.answer).toContain("Session 34");
  });
  it("does not attach Silent Vanguard's roster to an ANA question", async () => {
    const result = await answerQuestion("What is the latest session in ANA involving Lila?");
    expect(result.answer).toContain("Session 34");
    expect(result.answer).not.toContain("Cletus");
    expect(result.sources.every(source => source.campaign === "A New Adventure")).toBe(true);
  });
  it("does not mistake analysis for ANA", async () => {
    const result = await answerQuestion("Give an analysis of the latest session.");
    expect(result.answer).toContain("Choose a specific campaign");
    expect(result.sources).toEqual([]);
  });
  it("keeps retrieval scoped when world names occur in an ANA question", async () => {
    await retrieve("What happened in Qal'dynn in ANA?", { campaign: "ANA", visibility: "players" });
    expect(fixtures.search).toHaveBeenCalledWith(fixtures.index, [1], expect.objectContaining({
      campaign: "A New Adventure", visibility: "players",
    }));
  });
  it("retains separate SoD latest-session scope", async () => {
    const result = await answerQuestion("What is the latest session?", { campaign: "SoD" });
    expect(result.sources.map(source => source.campaign)).toEqual(["SoD"]);
  });
  it("composes selected-session answers from only that session", async () => {
    const result = await answerQuestion("Who was involved?", { campaign: "ANA", sessionTitle: "A New Adventure Session 34 - Recorded Events" });
    const context = JSON.stringify(fixtures.chat.mock.calls);
    expect(context).toContain("Ridley struck the beast");
    expect(context).not.toContain("Lila returned");
    expect(context).not.toContain("Secret DM plan");
    expect(result.sources.map(source => source.campaign)).toEqual(["A New Adventure"]);
    expect(fixtures.search).not.toHaveBeenCalled();
  });
  it.each([
    ["ANA", "A New Adventure Session 99 - Recorded Events"],
    ["SoD", "A New Adventure Session 34 - Recorded Events"],
    ["All", "A New Adventure Session 34 - Recorded Events"],
  ])("rejects hidden or out-of-campaign selected sessions", async (campaign, sessionTitle) => {
    const result = await answerQuestion("Who was involved?", {campaign, sessionTitle, visibility: "players"});
    expect(result.sources).toEqual([]);
    expect(fixtures.chat).not.toHaveBeenCalled();
  });
});
