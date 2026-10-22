import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveArtRunner } from "../lib/chronicle-art-runner.mjs";

test("selects the newest desktop bundle over a stale unversioned executable", t => {
  const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "chronicle-runner-"));
  t.after(() => fs.rmSync(localAppData, { recursive: true, force: true }));
  const bin = path.join(localAppData, "OpenAI", "Codex", "bin");
  fs.mkdirSync(path.join(bin, "new-bundle"), { recursive: true });
  fs.mkdirSync(path.join(bin, "broken-bundle"));
  const old = path.join(bin, "codex.exe");
  const current = path.join(bin, "new-bundle", "codex.exe");
  const broken = path.join(bin, "broken-bundle", "codex.exe");
  for (const file of [old, current, broken]) fs.writeFileSync(file, "");
  const versionOf = file => file === old ? "codex-cli 0.99.0" : file === current ? "codex-cli 0.163.0-alpha.11" : null;
  assert.equal(resolveArtRunner({ localAppData, versionOf }), current);
  // A stable release supersedes a preview with the same core version.
  assert.equal(resolveArtRunner({ localAppData, versionOf: file => file === old ? "codex-cli 0.163.0" : versionOf(file) }), old);
  assert.equal(resolveArtRunner({ localAppData, override: "C:/explicit/codex.exe", versionOf }), "C:/explicit/codex.exe");
  assert.equal(resolveArtRunner({ localAppData: path.join(localAppData, "absent"), versionOf }), "codex");
});
