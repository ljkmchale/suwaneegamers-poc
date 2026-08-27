import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "docs", "architecture-contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const failures = [];

function requirePath(relativePath, label) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`${label}: missing ${relativePath}`);
}

requirePath(contract.canonicalGuide, "canonical guide");
requirePath(contract.content.runtimeReader, "content reader");
requirePath(contract.content.fileMirror, "content mirror");
requirePath(contract.content.database, "content database");
requirePath(contract.media.imageDiskRoot, "image disk root");
requirePath(contract.media.imageRoute, "image route");
requirePath(contract.media.audioDiskRoot, "audio disk root");
requirePath(contract.media.audioRoute, "audio route");
requirePath(contract.voice.client, "voice client");
requirePath(contract.voice.tokenRoute, "voice token route");
requirePath(contract.voice.worker, "voice worker");
requirePath(contract.voice.healthRegistry, "Myra health registry");
requirePath(contract.voice.healthApi, "Myra health API");
requirePath(contract.voice.healthDashboard, "Myra health dashboard");
requirePath(contract.automation.scheduler, "content scheduler");
requirePath(contract.automation.myraHealthMonitor, "Myra health monitor");
requirePath(contract.automation.productionLauncher, "production launcher");

for (const instructionFile of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]) {
  requirePath(instructionFile, "AI instruction file");
  if (fs.existsSync(path.join(root, instructionFile))) {
    const text = fs.readFileSync(path.join(root, instructionFile), "utf8");
    if (!text.includes("docs/AI_ARCHITECTURE.md") || !text.includes("pnpm arch:preflight")) {
      failures.push(`${instructionFile}: missing mandatory architecture preflight instruction`);
    }
  }
}

const scriptFiles = fs.readdirSync(path.join(root, "scripts"))
  .filter((name) => name.endsWith(".mjs") && (name.startsWith("sync-") || name === "optimize-images.mjs"));
for (const filename of scriptFiles) {
  const source = fs.readFileSync(path.join(root, "scripts", filename), "utf8");
  for (const prefix of contract.media.forbiddenGeneratedPrefixes) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`[\"'\\x60]${escaped}`).test(source)) {
      failures.push(`scripts/${filename}: can generate obsolete ${prefix} URL`);
    }
  }
}

for (const [label, filename] of [
  ["image", "audit-local-images.mjs"],
  ["session-audio", "audit-local-audio.mjs"],
]) {
  const audit = spawnSync(process.execPath, [path.join(root, "scripts", filename)], {
    cwd: root,
    encoding: "utf8",
  });
  if (audit.status !== 0) {
    failures.push(`${label} audit failed:\n${(audit.stderr || audit.stdout).trim()}`);
  }
}

console.log("Suwanee Gamers architecture preflight");
console.log(`  Guide: ${contract.canonicalGuide}`);
console.log(`  Content: ${contract.content.database} -> ${contract.content.databaseFirstTable} -> ${contract.content.fileMirror}/ fallback`);
console.log(`  Images: ${contract.media.imageUrlPrefix} -> ${contract.media.imageDiskRoot}`);
console.log(`  Audio: ${contract.media.audioUrlPrefix} -> ${contract.media.audioDiskRoot}`);
console.log(`  Voice: LiveKit ${contract.voice.livekitPort}, Speaches ${contract.voice.speachesPort}, Parakeet ${contract.voice.parakeetPort}`);
console.log(`  Production: ${contract.runtime.productionService} on ${contract.runtime.productionUrl}, active slot via ${contract.runtime.productionSlotPointer}`);

if (failures.length) {
  console.error("\nArchitecture preflight failed:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
} else {
  console.log("\nArchitecture preflight passed.");
}
