import { describe, expect, it } from "vitest";
import journeys from "../../../content/campaign-journeys.json";
import { getDb } from "@/lib/db";

describe("automatic campaign journeys", () => {
  it("is generated from the session and map sources", () => {
    expect(journeys.sync.mode).toBe("automatic");
    expect(journeys.sync.sessionSource).toContain("session_summaries");
    expect(journeys.sync.mapSource).toContain("/api/world-data");
  });

  it("keeps generated session identities unique and source grounded", () => {
    const generated = journeys.campaigns.flatMap((campaign) =>
      campaign.stops.filter((stop) => "automatic" in stop && stop.automatic),
    );
    const sourceKeys = generated.map((stop) =>
      "sourceKey" in stop ? stop.sourceKey : undefined,
    );

    expect(generated).toHaveLength(journeys.sync.generatedStops);
    expect(new Set(sourceKeys).size).toBe(sourceKeys.length);

    for (const stop of generated) {
      expect("sourceKey" in stop && stop.sourceKey).toMatch(/:session-\d+$/);
      expect("sourceHash" in stop && stop.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect("confidence" in stop && stop.confidence).toBeGreaterThan(0);
      expect("confidence" in stop && stop.confidence).toBeLessThanOrEqual(1);
      expect(stop.summary.length).toBeGreaterThan(20);
      expect(stop.impact?.description.length).toBeGreaterThan(20);
    }
  });

  it("covers every available numbered session for mapped campaigns", () => {
    for (const journey of journeys.campaigns.filter(
      (campaign) => campaign.stops.length > 0,
    )) {
      const source = getDb()
        .prepare(
          `SELECT COUNT(*) AS count
           FROM session_summaries
           WHERE campaign_id = ? AND title GLOB '*[0-9]*'`,
        )
        .get(journey.id) as { count: number };
      expect(journey.stops, journey.name).toHaveLength(source.count);
    }
  });

  it("marks exactly the latest plotted stop as current", () => {
    for (const campaign of journeys.campaigns.filter(
      (item) => item.stops.length > 0,
    )) {
      const current = campaign.stops.filter((stop) => stop.current);
      expect(current, campaign.name).toHaveLength(1);
      expect(current[0]?.id).toBe(campaign.stops.at(-1)?.id);
    }
  });

  it("keeps A New Adventure on its verified Abbey-to-Caelora route", () => {
    const campaign = journeys.campaigns.find(
      (item) => item.id === "a-new-adventure",
    );
    expect(campaign).toBeDefined();

    const locations = new Map(
      campaign?.stops.map((stop) => [stop.session, stop.location]),
    );
    for (let session = 16; session <= 21; session += 1) {
      expect(locations.get(`Session ${session}`)).toBe("Abbey of Light");
    }
    expect(locations.get("Session 22")).toBe("Blackstone Crucible");
    expect(locations.get("Session 23")).toBe("Varenwood");
    expect(locations.get("Session 24")).toBe("Varenwood");
    expect(locations.get("Session 25")).toBe("Qal'dynn");
    expect(locations.get("Session 26")).toBe("Qal'dynn");
    expect(locations.get("Session 27")).toBe("Darafee");
    expect(locations.get("Session 28")).toBe("Caelora");
    expect(locations.get("Session 29")).toBe("Stygia");
    expect(locations.get("Session 30")).toBe("Caelora");

    const visited = new Set(campaign?.stops.map((stop) => stop.location));
    expect(visited.has("Dunduar")).toBe(false);
    expect(visited.has("Basctdelm")).toBe(false);
  });

  it("labels off-map automatic positions with reduced confidence", () => {
    const offMap = journeys.campaigns.flatMap((campaign) =>
      campaign.stops.filter(
        (stop) =>
          "automatic" in stop &&
          stop.automatic &&
          "precision" in stop &&
          stop.precision === "off-map",
      ),
    );
    expect(offMap.length).toBeGreaterThan(0);
    for (const stop of offMap) {
      expect("confidence" in stop && stop.confidence).toBeLessThanOrEqual(0.79);
    }
  });

  it("stores usable road geometry and persistent location impact history", () => {
    const routed = journeys.campaigns.flatMap((campaign) =>
      campaign.stops.filter(
        (stop) =>
          "route" in stop &&
          (stop.route?.mode === "road" || stop.route?.mode === "water"),
      ),
    );
    expect(routed.length).toBe(journeys.sync.routedSegments);
    for (const stop of routed) {
      expect("route" in stop && stop.route?.points.length).toBeGreaterThan(1);
    }
    expect(journeys.locationImpacts.length).toBe(journeys.sync.impactLocations);
  });
});
