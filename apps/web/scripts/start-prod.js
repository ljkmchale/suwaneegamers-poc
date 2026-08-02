// Starts Next from .next-prod so production and dev never share .next.
// Extra args are passed through, e.g. npm run start:prod -- -p 3001
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const contentDir = path.resolve(__dirname, "../../../content");
const repoRoot = path.resolve(__dirname, "../../..");
const webRoot = path.resolve(__dirname, "..");
const activePointer = path.join(webRoot, ".next-prod-active.json");
const allowedDistDirs = new Set([".next-prod", ".next-prod-a", ".next-prod-b"]);
let activeDistDir = ".next-prod";
if (fs.existsSync(activePointer)) {
  const parsed = JSON.parse(fs.readFileSync(activePointer, "utf8"));
  if (!allowedDistDirs.has(parsed.slot)) {
    throw new Error(`Unsafe production slot in ${activePointer}: ${parsed.slot}`);
  }
  activeDistDir = parsed.slot;
}
const metadataPath = path.join(webRoot, activeDistDir, "BUILD_METADATA.json");
const buildMetadata = fs.existsSync(metadataPath)
  ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  : {};
const schedulerEnabled = process.env.SUWANEE_CONTENT_SCHEDULER !== "0";
const healthMonitorEnabled = process.env.MYRA_HEALTH_MONITOR !== "0";
const schedulerToken = process.env.SUWANEE_SCHEDULER_TOKEN || randomUUID();
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const nextArgs = ["node_modules/next/dist/bin/next", "start", ...forwardedArgs];

function portFromArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === "-p" || arg === "--port") && args[index + 1]) return args[index + 1];
    if (arg.startsWith("--port=")) return arg.slice("--port=".length);
  }
  return null;
}

const port = process.env.PORT || portFromArgs(forwardedArgs) || "3000";
const sharedEnv = {
  ...process.env,
  // The active-slot pointer is authoritative. NSSM historically supplied
  // NEXT_DIST_DIR=.next-prod; allowing that legacy value to win silently
  // starts the old bundle after an A/B deployment.
  NEXT_DIST_DIR: activeDistDir,
  PORT: port,
  SUWANEE_CONTENT_DIR: contentDir,
  SUWANEE_SCHEDULER_TOKEN: schedulerToken,
  SUWANEE_BUILD_VERSION: buildMetadata.version || "legacy",
  SUWANEE_BUILD_ID: buildMetadata.buildId || "unknown",
  SUWANEE_BUILD_COMMIT: buildMetadata.commit || "unknown",
  SUWANEE_BUILD_BRANCH: buildMetadata.branch || "unknown",
  SUWANEE_BUILD_DIRTY: String(buildMetadata.dirty ?? false),
  SUWANEE_BUILD_TIME: buildMetadata.builtAt || "unknown",
};

console.log(
  `Starting Suwanee Gamers ${sharedEnv.SUWANEE_BUILD_VERSION} from ${activeDistDir}`,
);

const children = [];
let shuttingDown = false;

function startChild(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: sharedEnv,
    shell: false,
    windowsHide: true,
  });

  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`${label} exited${signal ? ` from ${signal}` : ` with code ${code}`}.`);
    if (label === "Next") shutdown(code ?? 1);
  });

  return child;
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (schedulerEnabled) {
  startChild("Content scheduler", process.execPath, ["scripts/content-scheduler.mjs"], { cwd: repoRoot });
}

if (healthMonitorEnabled) {
  startChild("Myra health monitor", process.execPath, ["scripts/myra-health-monitor.mjs"], { cwd: repoRoot });
}

startChild("Next", process.execPath, nextArgs);
