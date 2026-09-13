const CHRONICLE_ANALYTICS_SCRIPT = String.raw`<script data-sg-chronicle-analytics>
(() => {
  const path = window.location.pathname;
  const visitorKey = "sg-analytics-visitor";
  const visitKey = "sg-analytics-visit";
  const visitTimeout = 30 * 60 * 1000;
  let engagedSeconds = 0;
  let exitRecorded = false;
  let firstPayload = true;

  function identifier(key) {
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = key === visitorKey
        ? window.localStorage.getItem("sg-analytics-session") || window.crypto.randomUUID()
        : window.crypto.randomUUID();
      window.localStorage.setItem(key, value);
    }
    return value;
  }

  function visitId() {
    const now = Date.now();
    let visit = null;
    try { visit = JSON.parse(window.localStorage.getItem(visitKey) || "null"); } catch {}
    if (!visit || !visit.id || !visit.lastActivity || now - visit.lastActivity > visitTimeout) {
      visit = { id: window.crypto.randomUUID(), lastActivity: now };
      firstPayload = true;
    } else {
      visit.lastActivity = now;
    }
    window.localStorage.setItem(visitKey, JSON.stringify(visit));
    return visit.id;
  }

  function send(events, beacon = false) {
    if (!events.length) return;
    const search = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      sessionId: visitId(),
      visitorId: identifier(visitorKey),
      referrer: firstPayload ? document.referrer : undefined,
      acquisition: firstPayload ? {
        landingPath: path + window.location.search,
        referrer: document.referrer,
        utmSource: search.get("utm_source") || "",
        utmMedium: search.get("utm_medium") || "",
        utmCampaign: search.get("utm_campaign") || "",
      } : undefined,
      events: events.map((event) => ({ ...event, path })),
    });
    firstPayload = false;
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/events", new Blob([payload], { type: "application/json" }));
      return;
    }
    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  function pageLabel() {
    return (document.title || "Living Chronicle").replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function chapterDetails(section) {
    const heading = section.querySelector("h1");
    const kicker = section.querySelector(".kicker");
    const title = heading ? heading.textContent.trim() : section.id;
    const chapter = kicker ? kicker.textContent.trim() : "Chronicle chapter";
    return {
      contentType: "chronicle chapter",
      contentId: section.id,
      contentLabel: (chapter + " — " + title).slice(0, 160),
    };
  }

  send([{ eventType: "page_view", contentLabel: pageLabel() }]);

  const navigation = performance.getEntriesByType("navigation")[0];
  window.setTimeout(() => {
    const duration = navigation ? Math.round(navigation.loadEventEnd || navigation.duration) : 0;
    if (duration > 0) send([{ eventType: "page_load", contentLabel: pageLabel(), durationSeconds: duration }]);
  }, 1500);

  const viewed = new Set();
  const timers = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const section = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && !viewed.has(section.id)) {
        const timer = window.setTimeout(() => {
          viewed.add(section.id);
          send([{ eventType: "content_view", ...chapterDetails(section) }]);
          timers.delete(section);
        }, 7000);
        timers.set(section, timer);
      } else {
        const timer = timers.get(section);
        if (timer) window.clearTimeout(timer);
        timers.delete(section);
      }
    });
  }, { threshold: [0.55] });
  document.querySelectorAll("main .session[id]").forEach((section) => observer.observe(section));

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    const href = target.getAttribute("href") || "";
    if (href.startsWith("#s")) {
      const section = document.querySelector(href);
      if (section) send([{ eventType: "content_open", ...chapterDetails(section) }]);
      return;
    }
    if (!href) return;
    try {
      const url = new URL(href, window.location.origin);
      const internal = url.origin === window.location.origin;
      send([{
        eventType: internal ? "internal_click" : "outbound_click",
        contentType: "chronicle link",
        contentId: internal ? url.pathname + url.search : url.href,
        contentLabel: (target.textContent || target.title || "Chronicle link").replace(/\s+/g, " ").trim().slice(0, 160),
      }]);
    } catch {}
  }, true);

  const depths = new Set();
  function recordDepth() {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    [25, 50, 75, 100].forEach((milestone) => {
      if (depth >= milestone && !depths.has(milestone)) {
        depths.add(milestone);
        send([{ eventType: "scroll_depth", contentLabel: pageLabel(), durationSeconds: milestone }]);
      }
    });
  }
  window.addEventListener("scroll", recordDepth, { passive: true });
  recordDepth();

  window.setInterval(() => {
    if (document.visibilityState === "visible" && document.hasFocus()) engagedSeconds += 5;
  }, 5000);
  window.setInterval(() => {
    if (document.visibilityState === "visible") send([{ eventType: "heartbeat" }]);
  }, 30000);

  function flush() {
    if (!exitRecorded) {
      exitRecorded = true;
      send([{ eventType: "page_exit", contentLabel: pageLabel(), durationSeconds: engagedSeconds }], true);
    }
    if (engagedSeconds >= 5) {
      send([{ eventType: "page_engagement", durationSeconds: engagedSeconds }], true);
      engagedSeconds = 0;
    }
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
})();
</script>`;

export function injectChronicleAnalytics(html: string): string {
  if (html.includes("data-sg-chronicle-analytics")) return html;
  const bodyEnd = html.toLowerCase().lastIndexOf("</body>");
  if (bodyEnd === -1) return `${html}\n${CHRONICLE_ANALYTICS_SCRIPT}`;
  return `${html.slice(0, bodyEnd)}${CHRONICLE_ANALYTICS_SCRIPT}\n${html.slice(bodyEnd)}`;
}
