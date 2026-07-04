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
    | "media_complete"
    | "heartbeat";
  path?: string;
  contentType?: string;
  contentId?: string;
  contentLabel?: string;
  durationSeconds?: number;
};

const ANALYTICS_EVENT_NAME = "sg:usage-event";
let lastPageViewPath = "";
let firstPayload = true;

function analyticsEnabled() {
  return typeof window !== "undefined"
    && window.location.pathname !== "/admin"
    && !window.location.pathname.startsWith("/admin/");
}

function sessionId() {
  const key = "sg-analytics-session";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

function send(events: ClientUsageEvent[], beacon = false) {
  if (!analyticsEnabled() || events.length === 0) return;
  const payload = JSON.stringify({
    sessionId: sessionId(),
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

export function AnalyticsTracker() {
  const pathname = usePathname();
  const engagedSeconds = useRef(0);
  const trackedPath = useRef(pathname);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    trackedPath.current = pathname;
    engagedSeconds.current = 0;
    if (lastPageViewPath !== pathname) {
      lastPageViewPath = pathname;
      send([{ eventType: "page_view", path: pathname }]);
    }

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
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushEngagement();
    };
    window.addEventListener("pagehide", flushEngagement);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", flushEngagement);
      document.removeEventListener("visibilitychange", handleVisibility);
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

    window.addEventListener(ANALYTICS_EVENT_NAME, handleCustomEvent);
    document.addEventListener("play", handleMediaPlay, true);
    document.addEventListener("ended", handleMediaComplete, true);
    document.addEventListener("click", handleMediaButton, true);

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
      document.removeEventListener("play", handleMediaPlay, true);
      document.removeEventListener("ended", handleMediaComplete, true);
      document.removeEventListener("click", handleMediaButton, true);
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
