import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Desktop updates leave the old unversioned executable in place. Select the
// newest installed bundle rather than repeatedly launching that stale copy.
export function resolveArtRunner({ override, localAppData, versionOf = runnerVersion } = {}) {
  if (override?.trim()) return override.trim();
  const bin = path.join(localAppData ?? "", "OpenAI", "Codex", "bin");
  const candidates = [path.join(bin, "codex.exe")];
  try {
    for (const entry of fs.readdirSync(bin, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(path.join(bin, entry.name, "codex.exe"));
    }
  } catch { /* CLI on PATH is the fallback when desktop is absent. */ }
  return candidates.filter(file => fs.existsSync(file))
    .map(file => ({ file, version: versionOf(file) }))
    .filter(entry => entry.version)
    .sort((a, b) => compareVersions(b.version, a.version))[0]?.file ?? "codex";
}

function runnerVersion(file) {
  const result = spawnSync(file, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

function compareVersions(a, b) {
  const parse = value => /(?:^|\s)(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/.exec(value);
  const left = parse(a), right = parse(b);
  if (!left || !right) return a.localeCompare(b, undefined, { numeric: true });
  for (let i = 1; i <= 3; i++) {
    const difference = Number(left[i]) - Number(right[i]);
    if (difference) return difference;
  }
  if (!left[4] || !right[4]) return Number(!left[4]) - Number(!right[4]);
  return left[4].localeCompare(right[4], undefined, { numeric: true });
}
