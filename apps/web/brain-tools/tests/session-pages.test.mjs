import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { extractNoteSessions, syncSessionPages, markSessionPagesIndexed } from "../src/session-pages.mjs";

test("unfinished latest sessions exclude summary and goals appendices", () => {
  for (const appendix of ["Session Summary", "Session Summaries", "Goals", "# Session Summary"]) {
    const sessions = extractNoteSessions(`35 - <Name>\nSession Date: October 1, 2026\nRidley fought the beast and the party continued southward without resting.\n${appendix}\nSession 15 – Earlier events\nOld unrelated summary must not appear.`);
    assert.equal(sessions.length, 1);
    assert.match(sessions[0].body, /Ridley fought/);
    assert.doesNotMatch(sessions[0].body, /Earlier events|Old unrelated|Session Summar/);
  }
});

test("only dated session headers are published; trailing reference material is excluded", () => {
  const result = extractNoteSessions("1 - Potion\nInventory entry\n15 – Aunts & Necromancers\nSession Date: September 26, 2026\nEscanor fought the creature. This is documented action.\n– The End of the Session –\nDM Brief\nSecret omitted");
  assert.equal(result.length, 1);
  assert.equal(result[0].number, 15);
  assert.match(result[0].body, /Escanor fought/);
  assert.doesNotMatch(result[0].body, /Secret omitted/);
});

test("date-in-heading and tab-indented session formats are supported", () => {
  const result = extractNoteSessions("\t41 - The Mighty Jungle (08/10)\nThe party crossed the river and found the abandoned village.\n42 - Another Session\nSession Date: August 17, 2026\nThe party negotiated with the local captain about safe passage.");
  assert.deepEqual(result.map((row) => row.number), [41, 42]);
  assert.doesNotMatch(result[0].body, /negotiated/);
});

test("publication preserves curated pages, fills missing sessions, updates owned pages and is idempotent", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "myra-session-pages-"));
  try {
    const vaultRoot = path.join(root, "vault"), dataDir = path.join(root, "data");
    const directory = path.join(vaultRoot, "wiki", "sessions", "SoD");
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(path.join(vaultRoot, "raw"));
    const curated = "# SoD Session 08 - Curated\n\nKeep approved details unchanged.";
    await fs.writeFile(path.join(directory, "SoD Session 08.md"), curated);
    const raw = "08 - Curated\nSession Date: May 2, 2026\nThese older notes should not replace the curated page.\n15 - Aunts & Necromancers\nSession Date: September 26, 2026\nEscanor fought the creature and Kenton opened the gate.\n– The End of the Session –";
    await fs.writeFile(path.join(vaultRoot, "raw", "sod.md"), raw);
    const options = { vaultRoot, dataDir,
      sources: [{ campaign: "SoD", filename: "sod.md", url: "https://example.invalid/notes" }],
      campaigns: [{ id: "souls-of-destiny", name: "Souls of Destiny", vaultCampaign: "SoD", sessions: [
        { title: "Session 14 - Everybody Duck!", summary: "A previously approved summary remains usable as a fallback." },
      ] }] };
    const first = await syncSessionPages(options);
    assert.equal(first.written, 2);
    assert.equal(first.campaigns[0].latestPublished, 15);
    assert.equal(first.campaigns[0].summaryBehindNotes, true);
    assert.equal(await fs.readFile(path.join(directory, "SoD Session 08.md"), "utf8"), curated);
    const latest = path.join(vaultRoot, first.campaigns[0].latestSession.path);
    const latestSession = first.campaigns[0].latestSession;
    await markSessionPagesIndexed({dataDir, index: { createdAt: "verified-index",
      fileHashes: {[latestSession.path]: latestSession.bodyHash},
      pages: {[latestSession.path]: {visibility: "players"}} }});
    assert.match(await fs.readFile(latest, "utf8"), /visibility: players/);
    const repeated = await syncSessionPages(options);
    assert.equal(repeated.written, 0);
    assert.equal(repeated.campaigns[0].latestSession.indexedAt, "verified-index");
    for (const [hash, visibility] of [["wrong-hash", "players"], [latestSession.bodyHash, "dm"]]) {
      await markSessionPagesIndexed({dataDir, index: {createdAt: "invalid-index",
        fileHashes: {[latestSession.path]: hash}, pages: {[latestSession.path]: {visibility}}}});
      const report = JSON.parse(await fs.readFile(path.join(dataDir, "session-freshness.json"), "utf8"));
      assert.equal(report.campaigns[0].latestSession.indexedAt, null);
    }
    await fs.writeFile(path.join(vaultRoot, "raw", "sod.md"), raw.replace("opened the gate", "closed the gate"));
    const updated = await syncSessionPages(options);
    assert.equal(updated.written, 1);
    assert.equal(updated.campaigns[0].latestSession.indexedAt, null);
    assert.match(await fs.readFile(latest, "utf8"), /closed the gate/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("approved summaries cover campaigns with no configured notes source", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "myra-summary-pages-"));
  try {
    const result = await syncSessionPages({ vaultRoot: root, dataDir: path.join(root, "data"), sources: [],
      campaigns: [{ id: "a-new-adventure", name: "A New Adventure", vaultCampaign: "A New Adventure",
        sessions: [{ title: "Session 34 - Signs", summary: "The party discovered the signs during its documented journey." }] }] });
    assert.equal(result.campaigns[0].latestPublished, 34);
    assert.match(await fs.readFile(path.join(root, result.campaigns[0].latestSession.path), "utf8"), /source_kind: approved-session-summary/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
