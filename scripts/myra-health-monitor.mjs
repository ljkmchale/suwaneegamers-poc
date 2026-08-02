const port = process.env.PORT || "4652";
const baseUrl = process.env.MYRA_HEALTH_MONITOR_URL ?? `http://127.0.0.1:${port}`;
const token = process.env.SUWANEE_SCHEDULER_TOKEN;
const quickIntervalMs = Math.max(15_000, Number(process.env.MYRA_HEALTH_QUICK_INTERVAL_MS ?? 60_000));
const fullIntervalMs = Math.max(quickIntervalMs, Number(process.env.MYRA_HEALTH_FULL_INTERVAL_MS ?? 300_000));
let lastFullAt = 0;
let running = false;

if (!token) throw new Error("SUWANEE_SCHEDULER_TOKEN is required for the Myra health monitor.");

async function check() {
  if (running) return;
  running = true;
  const now = Date.now();
  const depth = now - lastFullAt >= fullIntervalMs ? "full" : "quick";
  try {
    const response = await fetch(`${baseUrl}/api/myra/health/monitor`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ depth }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (depth === "full") lastFullAt = now;
    console.log(JSON.stringify({ event: "myra_health_monitor", depth, ...result }));
  } catch (error) {
    console.error(JSON.stringify({ event: "myra_health_monitor_error", depth, errorCode: error instanceof Error ? error.name : "UNKNOWN" }));
  } finally {
    running = false;
  }
}

// Give Next time to bind its port, then retry naturally if startup is still in progress.
setTimeout(check, 5_000);
setInterval(check, quickIntervalMs);
