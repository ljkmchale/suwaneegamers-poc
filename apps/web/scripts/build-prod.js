// Build into the inactive A/B production slot. Next embeds distDir in its
// generated server bundle, so a completed build directory must never be
// renamed. The restart script activates the slot by updating a small pointer
// file while the service is stopped.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createBuildMetadata } = require("./build-version");

const contentDir = path.resolve(__dirname, "../../../content");
const repoRoot = path.resolve(__dirname, "../../..");
const webDir = path.resolve(__dirname, "..");
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
const metadata = createBuildMetadata({ repoRoot, webDir, buildId: id });
fs.writeFileSync(
  path.join(stagingDir, "BUILD_METADATA.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
fs.writeFileSync(
  readyPointer,
  `${JSON.stringify({ slot: stagingName, ...metadata }, null, 2)}\n`,
);
console.log(`Production bundle ${metadata.version} ready in immutable slot ${stagingDir}`);
