const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function git(repoRoot, args, fallback = "unknown") {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function createBuildMetadata({ repoRoot, webDir, buildId, now = new Date() }) {
  const packageVersion = JSON.parse(
    fs.readFileSync(path.join(webDir, "package.json"), "utf8"),
  ).version;
  const commit = git(repoRoot, ["rev-parse", "--short=12", "HEAD"]);
  const branch = git(repoRoot, ["branch", "--show-current"]);
  const dirty = git(repoRoot, ["status", "--porcelain"], "") !== "";
  const builtAt = now.toISOString();
  const timestamp = builtAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const version = `${packageVersion}+${timestamp}.${commit}${dirty ? ".dirty" : ""}`;

  return { version, packageVersion, buildId, commit, branch, dirty, builtAt };
}

module.exports = { createBuildMetadata };
