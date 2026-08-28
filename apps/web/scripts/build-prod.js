// Build into the inactive A/B production slot. Next embeds distDir in its
// generated server bundle, so a completed build directory must never be
// renamed. The restart script activates the slot by updating a small pointer
// file while the service is stopped.
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createBuildMetadata } = require("./build-version");

const contentDir = path.resolve(__dirname, "../../../content");
const repoRoot = path.resolve(__dirname, "../../..");
const webDir = path.resolve(__dirname, "..");

// Refuse to mint a production bundle without a real session secret. Both A/B
// slots read the same apps/web/.env.local at runtime, so if it lacks a strong
// ADMIN_SESSION_SECRET the server falls back to the shared dev secret in
// lib/userSession.ts — and a cookie sealed by one process can then fail to
// decrypt in another, silently dropping a signed-in visitor's identity (that is
// the "Unidentified visitor" analytics ghost we chased down). Load env exactly
// the way `next build` will, then fail loudly before building.
const DEV_FALLBACK_SESSION_SECRET = "fallback-dev-secret-change-in-production-32chars";
// Read one key from the same .env files `next build`/the runtime server load,
// with the shell's own environment taking precedence. Minimal on purpose: a
// single unquoted-or-quoted KEY=VALUE lookup, no interpolation.
function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    const full = path.join(webDir, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (match && match[1] === key) {
        return match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  }
  return undefined;
}
function assertSessionSecret() {
  const secret = readEnvValue("ADMIN_SESSION_SECRET");
  if (!secret || secret.length < 32 || secret === DEV_FALLBACK_SESSION_SECRET) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing, too short (<32 chars), or the dev fallback. " +
        "Set a strong 32+ char value in apps/web/.env.local before building for production. " +
        "Without it the running service silently falls back to the shared dev secret.",
    );
  }
}

assertSessionSecret();
const allowedSlots = new Set([".next-prod-a", ".next-prod-b"]);
const activePointer = path.join(webDir, ".next-prod-active.json");
const readyPointer = path.join(webDir, ".next-prod-ready.json");
let activeSlot = "";
if (fs.existsSync(activePointer)) {
  const parsed = JSON.parse(fs.readFileSync(activePointer, "utf8"));
  if (allowedSlots.has(parsed.slot)) activeSlot = parsed.slot;
}
const stagingName = activeSlot === ".next-prod-a" ? ".next-prod-b" : ".next-prod-a";
const stagingDir = path.join(webDir, stagingName);
// Commit regenerated content before stamping build metadata. The scheduled
// content-sync jobs (assistant-brain build, learn/tune, roster + session-card
// sync) rewrite content/*.json continuously; if a prod build runs with those
// uncommitted, createBuildMetadata below stamps the bundle ".dirty". Committing
// the content snapshot first keeps production builds clean. Scoped to content/
// ONLY (pathspec on both add and commit) so source or other work-in-progress is
// never swept into the commit. Opt out with BUILD_NO_CONTENT_AUTOCOMMIT=1.
function autoCommitContentSnapshot() {
  if (process.env.BUILD_NO_CONTENT_AUTOCOMMIT === "1") return;
  let status;
  try {
    status = execFileSync("git", ["status", "--porcelain", "--", "content"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return; // not a git repo, or git unavailable — nothing to auto-commit
  }
  if (!status) return;
  const fileCount = status.split("\n").filter(Boolean).length;
  try {
    execFileSync("git", ["add", "--", "content"], { cwd: repoRoot, stdio: "ignore" });
    execFileSync(
      "git",
      [
        "commit",
        "-q",
        "-m",
        "Commit content-sync snapshot before build\n\nAuto-committed by build-prod.js: the scheduled content-sync jobs regenerate\ncontent/*.json, and an uncommitted tree stamps the production build .dirty.",
        "--",
        "content",
      ],
      { cwd: repoRoot, stdio: "ignore" },
    );
    console.log(`[build-prod] committed content-sync snapshot (${fileCount} file(s)) to keep the build clean`);
  } catch (error) {
    // A commit failure (nothing to commit after a race, a rejecting hook) must
    // never block the build — warn and proceed; a .dirty stamp is still safe.
    console.warn(`[build-prod] content auto-commit skipped: ${error.message}`);
  }
}

autoCommitContentSnapshot();

// Capture source identity before Next rewrites generated files such as
// next-env.d.ts for the selected distDir. Build-generated churn must not make a
// clean source checkout look dirty in production metadata.
const sourceMetadata = createBuildMetadata({ repoRoot, webDir, buildId: "pending" });

if (path.dirname(stagingDir) !== webDir || !allowedSlots.has(stagingName)) {
  throw new Error(`Unsafe production staging directory: ${stagingDir}`);
}
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

execSync("node node_modules/next/dist/bin/next build --webpack", {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: stagingName,
    SUWANEE_CONTENT_DIR: contentDir,
  },
});

const buildId = path.join(stagingDir, "BUILD_ID");
if (!fs.existsSync(buildId)) {
  throw new Error(`Production staging build did not create ${buildId}`);
}
const id = fs.readFileSync(buildId, "utf8").trim();
const metadata = { ...sourceMetadata, buildId: id };
fs.writeFileSync(
  path.join(stagingDir, "BUILD_METADATA.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
fs.writeFileSync(
  readyPointer,
  `${JSON.stringify({ slot: stagingName, ...metadata }, null, 2)}\n`,
);
console.log(`Production bundle ${metadata.version} ready in immutable slot ${stagingDir}`);

// The A/B slot alternation makes `next build` rewrite next-env.d.ts to import
// the slot it just built (./.next-prod-a vs ./.next-prod-b/types/routes.d.ts).
// That flip leaves the file modified after every other build, which would stamp
// the NEXT build .dirty even with a clean source tree. Restore it to the
// committed version so the working tree stays clean between builds. The file
// stays tracked (CI typecheck needs its Next type references present) and the
// next `next build` regenerates it. Failure here is cosmetic, so never throw.
try {
  execFileSync("git", ["checkout", "--", "next-env.d.ts"], { cwd: webDir, stdio: "ignore" });
} catch {
  /* not a git checkout or git unavailable — a leftover next-env.d.ts diff is harmless */
}
