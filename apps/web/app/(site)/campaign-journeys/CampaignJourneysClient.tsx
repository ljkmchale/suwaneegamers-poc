"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CampaignImpactType,
  CampaignJourney,
  CampaignJourneysDocument,
  CampaignJourneyStop,
} from "@/lib/campaignJourneys";
import styles from "./CampaignJourneysClient.module.css";

const MAP_HEIGHT = (788 / 1400) * 100;
const PLAYBACK_DURATION_MS = 32_000;

const IMPACT_LABELS: Record<CampaignImpactType, string> = {
  arcane: "Arcane shift",
  battle: "Battle",
  discovery: "Discovery",
  political: "Political change",
  rescue: "Rescue",
  warning: "Danger remains",
};

const IMPACT_SYMBOLS: Record<CampaignImpactType, string> = {
  arcane: "✦",
  battle: "⚔",
  discovery: "◆",
  political: "♜",
  rescue: "✚",
  warning: "!",
};

function mapY(y: number) {
  return (y / 100) * MAP_HEIGHT;
}

function routeProgress(
  from: CampaignJourneyStop,
  to: CampaignJourneyStop,
  progress: number,
) {
  const storedPoints =
    to.route?.points && to.route.points.length > 1
      ? to.route.points
      : [
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        ];
  const points = [...storedPoints];
  const first = points[0];
  if (!first || first.x !== from.x || first.y !== from.y) {
    points.unshift({ x: from.x, y: from.y });
  }
  const last = points[points.length - 1];
  if (!last || last.x !== to.x || last.y !== to.y) {
    points.push({ x: to.x, y: to.y });
  }

  const segmentLengths = points.slice(1).map((point, index) =>
    Math.hypot(
      point.x - points[index].x,
      mapY(point.y) - mapY(points[index].y),
    ),
  );
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) {
    return { point: { x: to.x, y: to.y }, points };
  }

  const targetLength = Math.max(0, Math.min(1, progress)) * totalLength;
  const partial = [points[0]];
  let traveled = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index];
    const start = points[index];
    const end = points[index + 1];
    if (traveled + length >= targetLength) {
      const ratio = length === 0 ? 1 : (targetLength - traveled) / length;
      const point = {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
      partial.push(point);
      return { point, points: partial };
    }
    partial.push(end);
    traveled += length;
  }
  return { point: { x: to.x, y: to.y }, points };
}

function revealedStops(campaign: CampaignJourney, progress: number) {
  if (campaign.stops.length <= 1) return campaign.stops;
  const journeyPosition =
    Math.max(0, Math.min(100, progress)) /
    100 *
    (campaign.stops.length - 1);
  const reachedIndex = Math.floor(journeyPosition);
  const legProgress = journeyPosition - reachedIndex;
  const reached = campaign.stops.slice(0, reachedIndex + 1);
  const from = campaign.stops[reachedIndex];
  const to = campaign.stops[reachedIndex + 1];

  if (!from || !to || legProgress < 0.0001) return reached;

  const partial = routeProgress(from, to, legProgress);
  const movingStop: CampaignJourneyStop = {
    ...to,
    id: `playback-${campaign.id}`,
    location: `En route to ${to.location}`,
    x: partial.point.x,
    y: partial.point.y,
    current: false,
    impact: undefined,
    route: {
      ...(to.route ?? { mode: "direct" as const, points: partial.points }),
      points: partial.points,
    },
  };
  return [...reached, movingStop];
}

function initials(name: string) {
  const ignored = new Set(["of", "the"]);
  return name
    .split(/\s+/)
    .filter((part) => !ignored.has(part.toLowerCase()))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function routePath(stops: CampaignJourneyStop[]) {
  if (stops.length === 0) return "";
  const commands = [`M ${stops[0].x} ${mapY(stops[0].y)}`];
  for (const stop of stops.slice(1)) {
    const points =
      stop.route?.points && stop.route.points.length > 1
        ? stop.route.points
        : [{ x: stop.x, y: stop.y }];
    for (const point of points.slice(points.length > 1 ? 1 : 0)) {
      commands.push(`L ${point.x} ${mapY(point.y)}`);
    }
  }
  return commands.join(" ");
}

interface LocatedStop {
  campaign: CampaignJourney;
  stop: CampaignJourneyStop;
}

export function CampaignJourneysClient({
  document,
}: {
  document: CampaignJourneysDocument;
}) {
  const plottedCampaigns = useMemo(
    () => document.campaigns.filter((campaign) => campaign.stops.length > 0),
    [document.campaigns],
  );
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [progress, setProgress] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState({ x: 50, y: MAP_HEIGHT / 2 });
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const visibleCampaigns = useMemo(
    () =>
      campaignFilter === "all"
        ? plottedCampaigns
        : plottedCampaigns.filter((campaign) => campaign.id === campaignFilter),
    [campaignFilter, plottedCampaigns],
  );

  const visibleJourneys = useMemo(
    () =>
      visibleCampaigns.map((campaign) => ({
        campaign,
        stops: revealedStops(campaign, progress),
      })),
    [progress, visibleCampaigns],
  );

  let selected: LocatedStop | null = null;
  if (selectedStopId) {
    for (const campaign of document.campaigns) {
      const stop = campaign.stops.find((item) => item.id === selectedStopId);
      if (stop) {
        selected = { campaign, stop };
        break;
      }
    }
  }

  const latestVisibleStops = useMemo(
    () =>
      visibleJourneys
        .map(({ campaign, stops }) => ({
          campaign,
          stop: stops[stops.length - 1],
        }))
        .filter((item): item is LocatedStop => Boolean(item.stop)),
    [visibleJourneys],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousTime: number | null = null;
    const animate = (time: number) => {
      const elapsed = previousTime === null ? 0 : time - previousTime;
      previousTime = time;
      setProgress((current) => {
        if (current >= 100) {
          setPlaying(false);
          return 100;
        }
        return Math.min(100, current + (elapsed / PLAYBACK_DURATION_MS) * 100);
      });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const allStops = document.campaigns.reduce(
    (total, campaign) => total + campaign.stops.length,
    0,
  );
  const allImpacts = document.campaigns.reduce(
    (total, campaign) =>
      total + campaign.stops.filter((stop) => Boolean(stop.impact)).length,
    0,
  );

  const viewWidth = 100 / zoom;
  const viewHeight = MAP_HEIGHT / zoom;
  const viewX = Math.max(0, Math.min(100 - viewWidth, focus.x - viewWidth / 2));
  const viewY = Math.max(
    0,
    Math.min(MAP_HEIGHT - viewHeight, focus.y - viewHeight / 2),
  );
  const viewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;

  function chooseCampaign(id: string) {
    setCampaignFilter(id);
    setSelectedStopId(null);
    const campaign = plottedCampaigns.find((item) => item.id === id);
    const last = campaign?.stops[campaign.stops.length - 1];
    if (last) {
      setFocus({ x: last.x, y: mapY(last.y) });
      setZoom(Math.max(zoom, 1.35));
    } else {
      setFocus({ x: 50, y: MAP_HEIGHT / 2 });
      setZoom(1);
    }
  }

  function selectStop(campaign: CampaignJourney, stop: CampaignJourneyStop) {
    setSelectedStopId(stop.id);
    setFocus({ x: stop.x, y: mapY(stop.y) });
    setZoom((current) => Math.max(current, 1.7));
    if (campaignFilter !== "all" && campaignFilter !== campaign.id) {
      setCampaignFilter(campaign.id);
    }
  }

  function resetMap() {
    setCampaignFilter("all");
    setProgress(100);
    setPlaying(false);
    setSelectedStopId(null);
    setZoom(1);
    setFocus({ x: 50, y: MAP_HEIGHT / 2 });
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-20 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden border-y border-white/10 py-12 text-center sm:rounded-2xl sm:border">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 50% 10%, rgba(139,92,246,.5), transparent 44%), radial-gradient(circle at 10% 90%, rgba(59,130,246,.28), transparent 36%)",
          }}
        />
        <div className="relative">
          <p
            className="mb-3 font-cinzel text-[10px] uppercase tracking-[0.5em]"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            The living history of the world
          </p>
          <h1 className="shimmer-text font-cinzel text-3xl uppercase tracking-[0.13em] sm:text-5xl">
            {document.title}
          </h1>
          <p
            className="mx-auto mt-4 max-w-2xl text-sm sm:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {document.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2 text-xs">
            {document.sync?.mode === "automatic" && (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-emerald-100">
                Automatic session sync
              </span>
            )}
            <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2">
              <strong className="text-white">{plottedCampaigns.length}</strong>{" "}
              mapped parties
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2">
              <strong className="text-white">{allStops}</strong> story stops
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2">
              <strong className="text-white">{allImpacts}</strong> world echoes
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div
          className={`${styles.mapShell} overflow-hidden rounded-2xl border border-white/10`}
        >
          <div className="border-b border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => chooseCampaign("all")}
                  className={`rounded-full border px-3 py-2 font-cinzel text-[9px] uppercase tracking-[0.14em] transition ${
                    campaignFilter === "all"
                      ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white"
                  }`}
                >
                  All parties
                </button>
                {plottedCampaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => chooseCampaign(campaign.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 font-cinzel text-[9px] uppercase tracking-[0.11em] transition ${
                      campaignFilter === campaign.id
                        ? "text-white"
                        : "border-white/10 bg-white/5 text-white/55 hover:border-white/30 hover:text-white"
                    }`}
                    style={
                      campaignFilter === campaign.id
                        ? {
                            borderColor: `${campaign.color}aa`,
                            backgroundColor: `${campaign.color}18`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: campaign.color,
                        boxShadow: `0 0 10px ${campaign.color}`,
                      }}
                    />
                    {campaign.name}
                  </button>
                ))}
              </div>

              <div className="grid items-center gap-3 md:grid-cols-[auto_minmax(180px,1fr)_auto]">
                <button
                  type="button"
                  onClick={() => {
                    if (progress >= 100) setProgress(0);
                    setPlaying((current) => !current);
                  }}
                  className="rounded-lg border border-violet-300/30 bg-violet-400/10 px-4 py-2 font-cinzel text-[10px] uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/20"
                >
                  {playing ? "Pause history" : "Play history"}
                </button>
                <label className="grid gap-1">
                  <span className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-white/45">
                    <span>Journey progress</span>
                    <span>{Math.round(progress)}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(event) => {
                      setPlaying(false);
                      setProgress(Number(event.target.value));
                    }}
                    className="accent-violet-400"
                    aria-label="Journey progress"
                  />
                </label>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((current) => Math.max(1, current - 0.35))}
                    className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-lg text-white/70 hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((current) => Math.min(3.2, current + 0.35))}
                    className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-lg text-white/70 hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={resetMap}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-cinzel text-[9px] uppercase tracking-widest text-white/55 hover:bg-white/10 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.mapViewport} relative overflow-hidden`}>
            <svg
              className={styles.mapSvg}
              viewBox={viewBox}
              role="img"
              aria-label="Interactive campaign journey map of Myrdae"
            >
              <image
                href={document.mapImage}
                x="0"
                y="0"
                width="100"
                height={MAP_HEIGHT}
                preserveAspectRatio="none"
              />
              <rect
                x="0"
                y="0"
                width="100"
                height={MAP_HEIGHT}
                fill="rgba(2, 8, 18, 0.16)"
              />

              {visibleJourneys.map(({ campaign, stops }) => {
                if (stops.length < 2) return null;
                const d = routePath(stops);
                return (
                  <g key={`${campaign.id}-route`}>
                    <path
                      d={d}
                      className={styles.routeGlow}
                      stroke={campaign.color}
                    />
                    <path
                      d={d}
                      className={styles.route}
                      stroke={campaign.color}
                    />
                  </g>
                );
              })}

              {visibleJourneys.flatMap(({ campaign, stops }) =>
                stops.map((stop, index) => {
                  const isLatest = index === stops.length - 1;
                  const isSelected = selectedStopId === stop.id;
                  const isTraveling = stop.id.startsWith("playback-");
                  const cy = mapY(stop.y);
                  return (
                    <g
                      key={stop.id}
                      role={isTraveling ? "img" : "button"}
                      tabIndex={isTraveling ? -1 : 0}
                      aria-label={`${campaign.name}: ${stop.location}, ${stop.title}`}
                      className={styles.stopButton}
                      transform={`translate(${stop.x} ${cy}) scale(${1 / zoom}) translate(${-stop.x} ${-cy})`}
                      onClick={
                        isTraveling
                          ? undefined
                          : () => selectStop(campaign, stop)
                      }
                      onKeyDown={(event) => {
                        if (isTraveling) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectStop(campaign, stop);
                        }
                      }}
                    >
                      {isLatest && (
                        <circle
                          cx={stop.x}
                          cy={cy}
                          r="1.15"
                          fill="none"
                          stroke={campaign.color}
                          strokeWidth="0.3"
                          className={styles.pulse}
                        />
                      )}
                      <circle
                        cx={stop.x}
                        cy={cy}
                        r={isLatest ? 0.82 : 0.48}
                        fill={isLatest ? campaign.color : "#07101d"}
                        stroke={campaign.color}
                        strokeWidth={isSelected ? 0.28 : 0.18}
                        className={styles.stopRing}
                      />
                      {stop.impact && !isLatest && (
                        <text
                          x={stop.x}
                          y={cy + 0.17}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={campaign.color}
                          fontSize="0.62"
                          fontWeight="800"
                        >
                          {IMPACT_SYMBOLS[stop.impact.type]}
                        </text>
                      )}
                      {isLatest && (
                        <text
                          x={stop.x}
                          y={cy + 0.08}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#07101d"
                          fontSize="0.48"
                          fontWeight="900"
                          className={styles.partyToken}
                        >
                          {initials(campaign.name)}
                        </text>
                      )}
                      {isSelected && (
                        <text
                          x={stop.x}
                          y={cy - 1.35}
                          textAnchor="middle"
                          fill="#fff8df"
                          fontSize="1.05"
                          fontFamily="Cinzel, serif"
                          fontWeight="700"
                          className={styles.selectedLabel}
                        >
                          {stop.location}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
            </svg>
            <div className={`${styles.scanline} absolute inset-0`} />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-[#050914]/80 px-3 py-2 text-[10px] text-white/55 backdrop-blur">
              Solid markers are each party&apos;s position at the selected story point.
              Click any stop to open its history.
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          {selected ? (
            <article
              className={`${styles.impactCard} overflow-hidden rounded-2xl border border-white/10`}
              style={{ borderTopColor: selected.campaign.color }}
            >
              <div
                className="h-1"
                style={{
                  background: `linear-gradient(90deg, ${selected.campaign.color}, transparent)`,
                }}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className="font-cinzel text-[9px] uppercase tracking-[0.22em]"
                      style={{ color: selected.campaign.color }}
                    >
                      {selected.campaign.name}
                    </p>
                    <h2 className="mt-2 font-cinzel text-xl text-white">
                      {selected.stop.location}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStopId(null)}
                    className="h-8 w-8 rounded-full border border-white/10 text-white/45 hover:bg-white/10 hover:text-white"
                    aria-label="Close selected stop"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-white/40">
                  {selected.stop.session}
                  {selected.stop.precision === "approximate" &&
                    " · approximate map position"}
                  {selected.stop.precision === "off-map" &&
                    " · anchored at the last mapped position"}
                  {selected.stop.automatic && " · automatically synced"}
                </p>
                <h3 className="mt-5 font-cinzel text-sm text-amber-100">
                  {selected.stop.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {selected.stop.summary}
                </p>
                {selected.stop.impact && (
                  <div
                    className="mt-5 rounded-xl border p-4"
                    style={{
                      borderColor: `${selected.campaign.color}45`,
                      backgroundColor: `${selected.campaign.color}0d`,
                    }}
                  >
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">
                      {IMPACT_LABELS[selected.stop.impact.type]}
                    </p>
                    <p className="mt-2 font-cinzel text-sm text-white">
                      {selected.stop.impact.title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/60">
                      {selected.stop.impact.description}
                    </p>
                  </div>
                )}
                {selected.stop.route &&
                  selected.stop.route.mode !== "local" && (
                    <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/45">
                      <span className="uppercase tracking-[0.16em]">
                        {selected.stop.route.mode === "road"
                          ? "Road route"
                          : selected.stop.route.mode === "water"
                            ? "Sea route"
                            : selected.stop.route.mode === "portal"
                              ? "Planar passage"
                              : selected.stop.route.mode === "off-map"
                                ? "Off-map travel"
                                : "Overland travel"}
                      </span>
                      {selected.stop.route.miles && (
                        <span>
                          {" "}
                          · {selected.stop.route.miles} miles
                          {selected.stop.route.days
                            ? ` · about ${selected.stop.route.days} days`
                            : ""}
                        </span>
                      )}
                      {selected.stop.route.roadNames?.length ? (
                        <p className="mt-2 leading-5 text-white/55">
                          {selected.stop.route.roadNames.join(" → ")}
                        </p>
                      ) : null}
                    </div>
                  )}
                <Link
                  href={selected.campaign.campaignHref}
                  className="mt-5 inline-flex font-cinzel text-[10px] uppercase tracking-[0.18em] text-violet-200 transition hover:text-white"
                >
                  Open campaign →
                </Link>
              </div>
            </article>
          ) : (
            <article className={`${styles.impactCard} rounded-2xl border border-white/10 p-5`}>
              <p className="font-cinzel text-[9px] uppercase tracking-[0.24em] text-violet-200">
                World pulse
              </p>
              <h2 className="mt-2 font-cinzel text-xl text-white">
                Parties in motion
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                The map is showing the latest revealed position for every selected
                campaign.
              </p>
            </article>
          )}

          <div className="grid gap-2">
            {latestVisibleStops.map(({ campaign, stop }) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => selectStop(campaign, stop)}
                className={`${styles.impactCard} group rounded-xl border border-white/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: campaign.color,
                      boxShadow: `0 0 14px ${campaign.color}`,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-cinzel text-xs text-white">
                      {campaign.name}
                    </span>
                    <span className="mt-1 block text-xs text-white/45">
                      {stop.location} · {stop.session}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-white/65">
                      {stop.impact?.title ?? stop.title}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {document.campaigns
            .filter((campaign) => campaign.stops.length === 0)
            .map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-xl border border-dashed border-white/10 bg-black/15 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-cinzel text-xs text-white/60">{campaign.name}</p>
                    <p className="mt-1 text-xs text-white/35">{campaign.mapStatus}</p>
                  </div>
                  <Link
                    href={campaign.campaignHref}
                    className="text-xs text-violet-200/70 hover:text-violet-100"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
        </aside>
      </section>

      {document.locationImpacts && document.locationImpacts.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-cinzel text-[9px] uppercase tracking-[0.24em] text-violet-200">
                Persistent world history
              </p>
              <h2 className="mt-2 font-cinzel text-xl text-white">
                Places changed by the parties
              </h2>
            </div>
            <p className="text-xs text-white/40">
              {document.locationImpacts.length} locations carry campaign echoes
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {document.locationImpacts.slice(0, 6).map((history) => (
              <article
                key={history.id}
                className={`${styles.impactCard} rounded-xl border border-white/10 p-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-cinzel text-sm text-white">
                      {history.location}
                    </h3>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">
                      {history.impacts.length} recorded{" "}
                      {history.impacts.length === 1 ? "change" : "changes"}
                    </p>
                  </div>
                  {history.crossCampaign && (
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] uppercase tracking-wider text-amber-100">
                      Campaign crossing
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {history.impacts.slice(-3).map((impact) => (
                    <div
                      key={`${impact.campaignId}-${impact.session}`}
                      className="border-l border-white/10 pl-3"
                    >
                      <p className="text-[10px] text-white/40">
                        {impact.campaignName} · {impact.session}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/65">
                        {impact.title}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {(["battle", "political", "arcane"] as CampaignImpactType[]).map((type) => (
          <div
            key={type}
            className={`${styles.impactCard} rounded-xl border border-white/10 p-4`}
          >
            <span className="text-lg text-amber-200">{IMPACT_SYMBOLS[type]}</span>
            <p className="mt-2 font-cinzel text-xs uppercase tracking-widest text-white/75">
              {IMPACT_LABELS[type]}
            </p>
            <p className="mt-2 text-xs leading-5 text-white/45">
              Campaign movement is paired with the change it left behind, turning
              travel into a living history of Myrdae.
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
