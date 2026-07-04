import fs from "node:fs/promises";
import path from "node:path";
import { answerQuestion } from "../src/query.mjs";
import { clearCache } from "../src/query-cache.mjs";

const evalPath = path.resolve("tests", "golden-answers.json");
const raw = await fs.readFile(evalPath, "utf8");
const cases = JSON.parse(raw);

await clearCache();

let failures = 0;
for (const testCase of cases) {
  const result = await answerQuestion(testCase.question, {
    campaign: testCase.campaign ?? "All",
    visibility: testCase.visibility ?? "players",
    answerMode: testCase.answerMode ?? "direct",
    review: testCase.review ?? false,
    debug: true
  });

  const answer = result.answer ?? "";
  const paths = new Set((result.sources ?? []).map((source) => normalizePath(source.path)));
  const errors = [];

  for (const expected of testCase.mustInclude ?? []) {
    if (!answer.includes(expected)) errors.push(`missing answer text: ${expected}`);
  }
  for (const forbidden of testCase.mustNotInclude ?? []) {
    if (answer.includes(forbidden)) errors.push(`forbidden answer text: ${forbidden}`);
  }
  for (const sourcePath of testCase.expectedSources ?? []) {
    if (!paths.has(normalizePath(sourcePath))) errors.push(`missing source path: ${sourcePath}`);
  }
  for (const sourcePath of testCase.forbiddenSources ?? []) {
    if (paths.has(normalizePath(sourcePath))) errors.push(`forbidden source path: ${sourcePath}`);
  }
  if (testCase.requiresSourceAnchors !== false && !/Sources used:\s+\[\[/.test(answer)) {
    errors.push("missing Sources used anchors");
  }

  if (errors.length) {
    failures += 1;
    console.error(`FAIL ${testCase.name}`);
    for (const error of errors) console.error(`- ${error}`);
    console.error(answer);
    console.error("");
  } else {
    console.log(`PASS ${testCase.name}`);
  }
}

if (failures) {
  console.error(`${failures} / ${cases.length} answer-quality evals failed.`);
  process.exitCode = 1;
} else {
  console.log(`${cases.length} answer-quality evals passed.`);
}

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}
