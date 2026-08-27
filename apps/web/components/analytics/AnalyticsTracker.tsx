"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type ClientUsageEvent = {
  eventType:
    | "page_view"
    | "page_engagement"
    | "content_view"
    | "content_open"
    | "media_play"
    | "media_progress"
    | "media_complete"
    | "internal_click"
    | "outbound_click"
    | "search_query"
    | "search_result_click"
    | "search_no_results"
    | "search_to_library"
    | "scroll_depth"
    | "page_exit"
    | "page_load"
    | "client_error"
    | "heartbeat";
  path?: string;
  contentType?: string;
  contentId?: string;
  contentLabel?: string;
  durationSeconds?: number;
};

const ANALYTICS_EVENT_NAME = "sg:usage-event";
const VISIT_TIMEOUT_MS = 30 * 60 * 1000;
let lastPageViewPath = "";
let firstPayload = true;

function analyticsEnabled() {
  return typeof window !== "undefined"
    && window.location.pathname !== "/admin"
    && !window.location.pathname.startsWith("/admin/");
}

function visitorId() {
  const key = "sg-analytics-visitor";
  let id = window.localStorage.getItem(key);
  if (!id) {
    // Preserve the identifier installed by the original analytics tracker so
    // existing browsers remain recognizable after the visit model upgrade.
    id = window.localStorage.getItem("sg-analytics-session") ?? window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

function visitId() {
  const key = "sg-analytics-visit";
  const now = Date.now();
  type StoredVisit = { id: string; lastActivity: number };
  let visit: StoredVisit | null = null;
  try {
    visit = JSON.parse(window.localStorage.getItem(key) ?? "null") as StoredVisit | null;
  } catch {
    visit = null;
  }
  if (!visit?.id || !visit.lastActivity || now - visit.lastActivity > VISIT_TIMEOUT_MS) {
    visit = { id: window.crypto.randomUUID(), lastActivity: now };
    firstPayload = true;
  } else {
    visit.lastActivity = now;
  }
  window.localStorage.setItem(key, JSON.stringify(visit));
  return visit.id;
}

function pageLabel() {
  return document.querySelector("main h1")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160)
    || document.title.replace(/\s+/g, " ").trim().slice(0, 160);
}

function send(events: ClientUsageEvent[], beacon = false) {
  if (!analyticsEnabled() || events.length === 0) return;
  const payload = JSON.stringify({
    sessionId: visitId(),
    visitorId: visitorId(),
    referrer: firstPayload ? document.referrer : undefined,
    events: events.map((event) => ({
      ...event,
      path: event.path ?? window.location.pathname,
    })),
  });
  firstPayload = false;

  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/events",
      new Blob([payload], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics must never interfere with the page.
  });
}

export function recordUsageEvent(event: ClientUsageEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ClientUsageEvent>(ANALYTICS_EVENT_NAME, { detail: event }));
}

function elementLabel(element: Element): string {
  const explicit = element.getAttribute("data-analytics-label");
  if (explicit) return explicit;
  const ownLabel = element.getAttribute("aria-label") ?? element.getAttribute("title");
  if (ownLabel) return ownLabel.replace(/^Play\s+/i, "");
  const container = element.closest("article, section, [data-block-id], [data-section-id]");
  const heading = container?.querySelector("h1, h2, h3, h4");
  return heading?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160)
    || document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160)
    || document.title;
}

function mediaId(element: HTMLMediaElement): string {
  const source = element.currentSrc || element.getAttribute("src") || "";
  try {
    const parsed = new URL(source, window.location.origin);
    return parsed.origin === window.location.origin
      ? parsed.pathname
      : `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return source.slice(0, 300);
  }
}

function clickLabel(element: Element): string {
  return element.getAttribute("data-analytics-label")
    ?? element.getAttribute("aria-label")
    ?? element.getAttribute("title")
    ?? element.textContent?.replace(/\s+/g, " ").trim().slice(0, 160)
    ?? "Unlabeled link";
}

function normalizedHref(anchor: HTMLAnchorElement): string {
  const rawHref = anchor.getAttribute("href") ?? "";
  if (!rawHref) return "";
  try {
    const parsed = new URL(rawHref, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.href;
  } catch {
    return rawHref.slice(0, 300);
  }
}

function clickType(anchor: HTMLAnchorElement, href: string): string {
  if (anchor.closest("nav, header")) return "nav";
  if (anchor.closest("footer")) return "footer";
  if (anchor.closest("[data-media-control='true']")) return "media";
  const block = anchor.closest("[data-block-type]");
  const blockType = block?.getAttribute("data-block-type");
  if (blockType?.includes("campaign")) return "campaign";
  if (blockType?.includes("card") || anchor.closest("article")) return "card";
  if (!href.startsWith("/")) return "outbound";
  return "content";
}

function benignBrowserRejection(reason: unknown): boolean {
  const name = reason instanceof DOMException || reason instanceof Error ? reason.name : "";
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "";
  return (
    name === "AbortError" ||
    name === "NotAllowedError" ||
    /request is not allowed by the user agent or the platform/i.test(message) ||
    /permission denied/i.test(message)
  );
}

function rejectionDetails(reason: unknown): {
  label: string;
  type: string;
  source?: string;
} {
  if (reason instanceof Error) {
    return {
      label: reason.message || reason.name || "Promise rejection",
      type: `promise:${reason.name || "Error"}`.slice(0, 40),
      source: reason.stack?.replace(/\s+/g, " ").slice(0, 300),
    };
  }
  if (typeof reason === "string") {
    return { label: reason, type: "promise:string" };
  }
  try {
    const serialized = JSON.stringify(reason);
    return {
      label: serialized && serialized !== "{}" ? serialized : "Promise rejected without a reason",
      type: `promise:${Object.prototype.toString.call(reason).slice(8, -1)}`.slice(0, 40),
    };
  } catch {
    return { label: "Promise rejected with an unreadable reason", type: "promise:unknown" };
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const engagedSeconds = useRef(0);
  const trackedPath = useRef(pathname);
  const pageLoadRecorded = useRef(false);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    trackedPath.current = pathname;
    engagedSeconds.current = 0;
    let exitRecorded = false;
    const scrollMilestones = new Set<number>();
    if (lastPageViewPath !== pathname) {
      lastPageViewPath = pathname;
      send([{ eventType: "page_view", path: pathname, contentLabel: pageLabel() }]);
    }
    const loadTimer = pageLoadRecorded.current
      ? undefined
      : window.setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          const durationMs = nav ? Math.round(nav.loadEventEnd || nav.duration) : 0;
          if (durationMs > 0) {
            pageLoadRecorded.current = true;
            send([{
              eventType: "page_load",
              path: pathname,
              contentLabel: pageLabel(),
              durationSeconds: durationMs,
            }]);
          }
        }, 1500);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        engagedSeconds.current += 5;
      }
    }, 5_000);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        send([{ eventType: "heartbeat", path: trackedPath.current }]);
      }
    }, 30_000);

    const flushEngagement = () => {
      const duration = engagedSeconds.current;
      if (duration >= 5) {
        send([{
          eventType: "page_engagement",
          path: trackedPath.current,
          durationSeconds: duration,
        }], true);
        engagedSeconds.current = 0;
      }
    };
    const recordExit = () => {
      if (exitRecorded) return;
      exitRecorded = true;
      send([{
        eventType: "page_exit",
        path: trackedPath.current,
        durationSeconds: engagedSeconds.current,
        contentLabel: pageLabel(),
      }], true);
    };
    const handleScrollDepth = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const milestone of [25, 50, 75, 100]) {
        if (depth >= milestone && !scrollMilestones.has(milestone)) {
          scrollMilestones.add(milestone);
          send([{
            eventType: "scroll_depth",
            path: trackedPath.current,
            contentLabel: pageLabel(),
            durationSeconds: milestone,
          }]);
        }
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        recordExit();
        flushEngagement();
      }
    };
    const handlePageHide = () => {
      recordExit();
      flushEngagement();
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("scroll", handleScrollDepth, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    handleScrollDepth();

    return () => {
      window.clearInterval(interval);
      window.clearInterval(heartbeat);
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("scroll", handleScrollDepth);
      document.removeEventListener("visibilitychange", handleVisibility);
      recordExit();
      flushEngagement();
    };
  }, [pathname]);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    const handleCustomEvent = (event: Event) => {
      const usageEvent = event as CustomEvent<ClientUsageEvent>;
      send([{ ...usageEvent.detail, path: usageEvent.detail.path ?? pathname }]);
    };
    const handleMediaPlay = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      send([{
        eventType: "media_play",
        path: pathname,
        contentType: media instanceof HTMLVideoElement ? "video" : "audio",
        contentId: mediaId(media),
        contentLabel: elementLabel(media),
      }]);
    };
    const handleMediaComplete = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      send([{
        eventType: "media_complete",
        path: pathname,
        contentType: media instanceof HTMLVideoElement ? "video" : "audio",
        contentId: mediaId(media),
        contentLabel: elementLabel(media),
      }]);
    };
    const mediaProgress = new Map<HTMLMediaElement, Set<number>>();
    const handleMediaProgress = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement) || !Number.isFinite(media.duration) || media.duration <= 0) return;
      const percent = Math.floor((media.currentTime / media.duration) * 100);
      const seen = mediaProgress.get(media) ?? new Set<number>();
      for (const milestone of [25, 50, 75]) {
        if (percent >= milestone && !seen.has(milestone)) {
          seen.add(milestone);
          send([{
            eventType: "media_progress",
            path: pathname,
            contentType: media instanceof HTMLVideoElement ? "video" : "audio",
            contentId: mediaId(media),
            contentLabel: elementLabel(media),
            durationSeconds: milestone,
          }]);
        }
      }
      mediaProgress.set(media, seen);
    };
    const handleMediaButton = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const summary = target.closest("summary[aria-label^='Play ']");
      if (!summary || summary.parentElement?.querySelector("audio, video")) return;
      const frame = summary.parentElement?.querySelector("iframe");
      send([{
        eventType: "media_play",
        path: pathname,
        contentType: "embedded media",
        contentId: frame?.getAttribute("src") ?? summary.getAttribute("aria-label") ?? "",
        contentLabel: elementLabel(summary),
      }]);
    };
    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = normalizedHref(anchor);
      if (!href || href.startsWith("#")) return;
      const isInternal = href.startsWith("/");
      send([{
        eventType: isInternal ? "internal_click" : "outbound_click",
        path: pathname,
        contentType: clickType(anchor, href),
        contentId: href,
        contentLabel: clickLabel(anchor),
      }]);
    };
    const handleWindowError = (event: ErrorEvent) => {
      const source = event.error instanceof Error
        ? event.error.stack?.replace(/\s+/g, " ").slice(0, 300)
        : undefined;
      send([{
        eventType: "client_error",
        path: pathname,
        contentType: "window error",
        contentId: source ?? (event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined),
        contentLabel: event.message || "Client error",
      }]);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (benignBrowserRejection(event.reason)) return;
      const details = rejectionDetails(event.reason);
      send([{
        eventType: "client_error",
        path: pathname,
        contentType: details.type,
        contentId: details.source,
        contentLabel: details.label.slice(0, 160),
      }]);
    };

    window.addEventListener(ANALYTICS_EVENT_NAME, handleCustomEvent);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("play", handleMediaPlay, true);
    document.addEventListener("timeupdate", handleMediaProgress, true);
    document.addEventListener("ended", handleMediaComplete, true);
    document.addEventListener("click", handleMediaButton, true);
    document.addEventListener("click", handleClick, true);

    const timers = new Map<Element, number>();
    const seen = new Set<string>();
    const possibleContent = Array.from(document.querySelectorAll(
      "main [data-block-id], main [data-section-id], main article, main section",
    ));
    const candidates = possibleContent.filter(
      (element) => !possibleContent.some((other) => other !== element && element.contains(other)),
    );
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target;
        const id = element.getAttribute("data-block-id")
          ?? element.getAttribute("data-section-id")
          ?? element.querySelector("h1, h2, h3")?.textContent?.trim()
          ?? "";
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && !seen.has(id)) {
          const timer = window.setTimeout(() => {
            seen.add(id);
            send([{
              eventType: "content_view",
              path: pathname,
              contentType: element.hasAttribute("data-block-id") ? "block" : "section",
              contentId: id.slice(0, 300),
              contentLabel: elementLabel(element),
            }]);
            timers.delete(element);
          }, 7_000);
          timers.set(element, timer);
        } else {
          const timer = timers.get(element);
          if (timer) window.clearTimeout(timer);
          timers.delete(element);
        }
      }
    }, { threshold: [0.55] });
    candidates.forEach((element) => observer.observe(element));

    return () => {
      window.removeEventListener(ANALYTICS_EVENT_NAME, handleCustomEvent);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("play", handleMediaPlay, true);
      document.removeEventListener("timeupdate", handleMediaProgress, true);
      document.removeEventListener("ended", handleMediaComplete, true);
      document.removeEventListener("click", handleMediaButton, true);
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
