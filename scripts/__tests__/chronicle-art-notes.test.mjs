import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHeading,
  parseChapters,
  assessNotes,
  verifyBrief,
  slugify,
  asciiFold,
} from "../lib/chronicle-art-notes.mjs";

const filler = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

test("headings from every campaign export format parse", () => {
  assert.deepEqual(parseHeading("# **36 \\- Crimson Seat & Iron Ledger**"), { number: 36, title: "Crimson Seat & Iron Ledger" });
  assert.deepEqual(parseHeading("\t44 - Count On Your Fingers"), { number: 44, title: "Count On Your Fingers" });
  assert.deepEqual(parseHeading("11 – It’s Market Day"), { number: 11, title: "It’s Market Day" });
  assert.equal(parseHeading("Session Date: October 1, 2026"), null);
});

test("list items that look like headings are not chapters", () => {
  const text = [
    "1 - First", "a\nb", "2 - Second", "c", "3 - Third",
    "               * 2 – no, 5 – Guys", "d", "4 - Fourth", "e",
  ].join("\n");
  assert.deepEqual(parseChapters(text).map((c) => c.number), [1, 2, 3, 4]);
});

test("chapter bodies, keys and hashes", () => {
  const chapters = parseChapters("1 - One\nalpha beta\n2 - Two\ngamma");
  assert.equal(chapters[0].key, "01");
  assert.equal(chapters[0].body, "alpha beta");
  assert.equal(chapters[1].words, 1);
  assert.notEqual(chapters[0].hash, chapters[1].hash);
});

test("stub and template chapters are not real notes", () => {
  const stub = parseChapters(`5 - <Name>\n${filler(40)}`)[0];
  assert.equal(assessNotes(stub).real, false);
  const oneLine = parseChapters(`5 - Wall\n${filler(900)}`)[0];
  assert.equal(assessNotes(oneLine).real, false);
  const real = parseChapters(`5 - Real\n${Array.from({ length: 12 }, () => filler(60)).join("\n")}`)[0];
  assert.equal(assessNotes(real).real, true);
});

test("a scene brief must quote the notes and name people who appear", () => {
  const body = "Ridley moves his hunter’s mark to the beast and strikes one with his crossbow.\nFungus then casts spirit guardians and two of them take damage.";
  const good = {
    moment: "x", action: "x", location: "x",
    evidence: [
      "Ridley moves his hunter's mark to the beast and strikes one with his crossbow",
      "Fungus then casts spirit guardians and two of them take damage",
    ],
    participants: [{ name: "Ridley" }, { name: "Fungus Roundbelly" }],
  };
  assert.deepEqual(verifyBrief(good, body), []);
  const invented = { ...good, evidence: [good.evidence[0], "The dragon swoops down and burns the whole village to ash"] };
  assert.match(verifyBrief(invented, body).join("|"), /not in the notes/);
  const stranger = { ...good, participants: [{ name: "Zabeek" }] };
  assert.match(verifyBrief(stranger, body).join("|"), /never mentioned/);
});

test("slugs are short and url safe", () => {
  assert.equal(slugify("Ky’tha accepts Landra's offer on the Crimson Seat balcony"), "ky-tha-accepts-landra-s-offer");
  assert.equal(slugify("!!!"), "scene");
});

test("curly quotes in notes match the ASCII quotes Codex reads", () => {
  const body = "Affy asks “are there more of these corrupt beasts nearby” and the token moves to “no.”";
  assert.equal(asciiFold("It’s “quoted” — Æon"), "It's \"quoted\" - AEon");
  const brief = {
    moment: "x", action: "x", location: "x",
    evidence: [
      'Affy asks "are there more of these corrupt beasts nearby" and the token moves',
      'asks "are there more of these corrupt beasts nearby" and the token moves to "no."',
    ],
    participants: [{ name: 'Az’efal "Affy" Fairhand' }],
  };
  assert.deepEqual(verifyBrief(brief, body), []);
});

test("an unreadable mangled name is skipped, not fatal, while others still verify", () => {
  const body = "Meles lights his pipe while Dorin watches the fog and says nothing at all tonight.";
  const brief = {
    moment: "x", action: "x", location: "x",
    evidence: ["Meles lights his pipe while Dorin watches the fog", "Dorin watches the fog and says nothing at all tonight"],
    participants: [{ name: "Meles" }, { name: "A+on" }],
  };
  assert.deepEqual(verifyBrief(brief, body), []);
  assert.match(verifyBrief({ ...brief, participants: [{ name: "A+on" }] }, body).join("|"), /checkable/);
});
