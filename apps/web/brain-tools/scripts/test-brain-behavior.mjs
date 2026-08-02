// Exercises the live Chronicles endpoint (/api/brain/ask -> lib/brain/query.ts,
// Claude Haiku 4.5), not the parallel Groq engine in ../src/query.mjs, so these
// behavior checks validate exactly what visitors and the voice agent receive.
// Point BRAIN_ASK_URL at a running server (defaults to the prod service on 4652).
import { answerQuestion, askEndpoint } from "../src/ask-http.mjs";

const tests = [
  {
    name: "short HoE roster question routes to roster",
    question: "who is in HoE",
    includes: ["Ainslie", "Aurelius", "Hap", "Ky'tha", "Og", "Zymve"],
    excludes: ["where politics and power", "Journal of Tsulanan"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "SoD contraction roster question routes to roster",
    question: "who's in SoD",
    includes: ["Escanor", "Therric", "Zephyra", "Kenton", "Esylla", "Lila"],
    excludes: ["In the heart of Adsuren", "Kenton's presence"],
    sourcePaths: ["wiki/quick/SoD Quick Reference.md"]
  },
  {
    name: "TSV roster excludes SoD-only names",
    question: "who is in TSV",
    includes: ["Cletus", "Lensworth", "Jett Blackwood", "Axel Blackwood"],
    excludes: ["Zephyra", "Lila"],
    sourcePaths: ["wiki/quick/The Silent Vanguard Quick Reference.md"]
  },
  {
    name: "TSV Zephyra is a hard no, not a SoD answer",
    question: "Who is Zephyra in TSV?",
    includes: ["There is no Zephyra in The Silent Vanguard"],
    excludes: ["Souls of Destiny", "Adsuren", "Aeolenne"],
    sourcePaths: [
      "wiki/quick/The Silent Vanguard Quick Reference.md",
      "wiki/summaries/The Silent Vanguard.md"
    ],
    forbiddenSourcePaths: ["wiki/entities/Zephyra.md", "log.md"]
  },
  {
    name: "TSV Lila is a hard no, not a SoD answer",
    question: "Who is Lila in The Silent Vanguard?",
    includes: ["There is no Lila in The Silent Vanguard"],
    excludes: ["Souls of Destiny", "Lila Tealeaf", "crystal"],
    sourcePaths: [
      "wiki/quick/The Silent Vanguard Quick Reference.md",
      "wiki/summaries/The Silent Vanguard.md"
    ],
    forbiddenSourcePaths: ["wiki/entities/Lila.md", "log.md"]
  },
  {
    name: "TSV Zephyra player lookup is a hard no",
    question: "who plays Zephyra in TSV",
    includes: ["There is no Zephyra in The Silent Vanguard"],
    excludes: ["Jenny McHale", "Souls of Destiny", "Adsuren", "Aeolenne"],
    sourcePaths: [
      "wiki/quick/The Silent Vanguard Quick Reference.md",
      "wiki/summaries/The Silent Vanguard.md"
    ],
    forbiddenSourcePaths: ["wiki/entities/Zephyra.md", "log.md"]
  },
  {
    name: "wrong-campaign player lookup does not return selected roster",
    question: "who plays Jett Blackwood in SoD",
    includes: ["Jett Blackwood is not documented as part of Souls of Destiny's party"],
    excludes: ["Brian Winniford plays Escanor", "Chip Poole plays Therric"],
    sourcePaths: ["wiki/quick/SoD Quick Reference.md"]
  },
  {
    name: "valid player lookup still works",
    question: "who plays Zephyra in SoD",
    includes: ["Jenny McHale plays Zephyra in Souls of Destiny"],
    excludes: ["There is no Zephyra", "The Silent Vanguard"],
    sourcePaths: ["wiki/quick/SoD Quick Reference.md"]
  },
  {
    name: "D3 roster routes to quick reference",
    question: "who is in D3",
    includes: ["Meles", "Draelith", "Nixie", "Seraphine Veyne", "Nova", "Aeon"],
    excludes: ["Ainslie", "Kenton"],
    sourcePaths: ["wiki/quick/Dungeons III Quick Reference.md"]
  },
  {
    name: "Wyrm Bane roster routes to quick reference",
    question: "who is in WB",
    includes: ["Albross", "Caelion", "Lucerion", "Pagern Stonebuckle", "Rhody Falco"],
    excludes: ["Ainslie", "Kenton"],
    sourcePaths: ["wiki/quick/Bloody Endeavor Quick Reference.md"]
  },
  {
    name: "campaign acronym is answered deterministically",
    question: "What does HoE stand for?",
    includes: ["HoE stands for **Heroes of Emberstran**"],
    excludes: ["Ainslie", "Vintner"],
    sourcePaths: ["wiki/overview.md"]
  },
  {
    name: "wrong-campaign identity does not cross campaigns",
    question: "who is Kenton in HoE",
    includes: ["Kenton is not documented in Heroes of Emberstran"],
    excludes: ["Kenton's presence", "Adsuren"],
    sourcePaths: []
  },
  {
    name: "unknown external name in campaign is not invented",
    question: "Who is Darth Vader in HoE?",
    includes: ["Darth Vader is not documented in Heroes of Emberstran"],
    excludes: ["Ainslie", "Journal of Tsulanan", "Cloak of Defiance"],
    sourcePaths: []
  },
  {
    name: "unknown mascot name in campaign is not replaced with lore",
    question: "Who is Mickey Mouse in SoD?",
    includes: ["Mickey Mouse is not documented in Souls of Destiny"],
    excludes: ["Lila", "Aeolenne", "Adsuren Guard"],
    sourcePaths: []
  },
  {
    name: "maintenance-log questions do not mine lore",
    question: "What changed on May 14?",
    includes: ["I do not use the maintenance log"],
    excludes: ["Phira", "Rothenloch", "Nunglthil"],
    sourcePaths: []
  },
  {
    name: "real-world trivia is refused by the campaign brain",
    question: "What is the capital of France?",
    includes: ["outside the campaign brain"],
    sourcePaths: []
  },
  {
    name: "selected campaign roster uses selected scope",
    question: "who is in the party",
    campaign: "HoE",
    includes: ["Ainslie", "Aurelius", "Hap", "Ky'tha", "Og", "Zymve"],
    excludes: ["Kenton", "Zephyra"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "people wording routes to campaign roster",
    question: "who are all the people in HoE?",
    includes: ["Ainslie", "Aurelius", "Hap", "Ky'tha", "Og", "Zymve"],
    excludes: ["all the people is not documented"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "list players wording routes to campaign roster",
    question: "list players in SoD",
    includes: ["Brian Winniford", "Chip Poole", "Jenny McHale", "Larry McHale", "Lesley Poole", "Tiffany"],
    excludes: ["Current Read", "Adsuren"],
    sourcePaths: ["wiki/quick/SoD Quick Reference.md"]
  },
  {
    name: "player name maps to HoE character",
    question: "Who is Lesley Poole in HoE?",
    includes: ["Lesley Poole plays Ky'tha"],
    excludes: ["not documented", "Esylla"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "player name maps to SoD character",
    question: "Who is Lesley Poole in SoD?",
    includes: ["Lesley Poole plays Esylla"],
    excludes: ["not documented", "Ky'tha"],
    sourcePaths: ["wiki/quick/SoD Quick Reference.md"]
  },
  {
    name: "partial Larry player lookup maps within HoE",
    question: "Who plays Larry in HoE?",
    includes: ["Larry McHale plays Aurelius"],
    excludes: ["not documented"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "unique character player lookup still requires campaign scope",
    question: "which player plays Axel Blackwood?",
    includes: ["Choose a specific campaign"],
    excludes: ["Larry McHale plays Axel Blackwood"],
    sourcePaths: []
  },
  {
    name: "Aury alias resolves to Aurelius",
    question: "Who is Aury?",
    includes: ["Aury", "Aurelius"],
    excludes: ["not documented"],
    forbiddenSourcePaths: ["log.md"]
  },
  {
    name: "Lenny alias resolves to Lensworth",
    question: "Who is Lenny in TSV?",
    includes: ["Lensworth", "Lenny"],
    excludes: ["not documented"],
    forbiddenSourcePaths: ["log.md"]
  },
  {
    name: "Pagern partial name resolves in Wyrm Bane",
    question: "Who is Pagern in WB?",
    includes: ["Pagern"],
    excludes: ["not documented in Bloody Endeavor", "I found that name in All"],
    forbiddenSourcePaths: ["log.md"]
  },
  {
    name: "source request gives source pages, not biography",
    question: "What source says Lila is in SoD?",
    includes: ["wiki/entities/Lila.md"],
    excludes: ["halfling sorcerer", "crystal necklace serves"],
    sourcePaths: [
      "wiki/entities/Lila.md",
      "wiki/threads/Lila - Personal History And Goals.md"
    ]
  },
  {
    name: "selected TSV scope blocks Zephyra without SoD fallback",
    question: "Who is Zephyra?",
    campaign: "TSV",
    includes: ["There is no Zephyra in The Silent Vanguard"],
    excludes: ["Souls of Destiny", "Adsuren", "Aeolenne"],
    sourcePaths: [
      "wiki/quick/The Silent Vanguard Quick Reference.md",
      "wiki/summaries/The Silent Vanguard.md"
    ]
  },
  {
    name: "selected HoE scope blocks SoD character",
    question: "Who is Kenton?",
    campaign: "HoE",
    includes: ["Kenton is not documented in Heroes of Emberstran"],
    excludes: ["Adsuren", "House Reyvennra"],
    sourcePaths: []
  },
  {
    name: "unknown relationship shape still reaches relationship path",
    question: "What is the relationship between Kenton and Zephyra?",
    campaign: "SoD",
    includes: ["Kenton and Zephyra", "documented practical bond"],
    excludes: ["not documented in the current campaign brain", "dangerous or unresolved relationship"],
    forbiddenSourcePaths: ["log.md"]
  },
  {
    name: "threat relationship is not softened into party bond",
    question: "What is the connection between Aeolenne and Zephyra?",
    campaign: "SoD",
    includes: ["dangerous or unresolved relationship", "threat, identity, and unresolved consequences"],
    excludes: ["documented practical bond in the party"],
    forbiddenSourcePaths: ["log.md"]
  },
  {
    name: "relationship with fake name is refused",
    question: "What is the connection between Mickey Mouse and Kenton?",
    campaign: "SoD",
    includes: ["Mickey Mouse is not documented"],
    excludes: ["Kenton, a player character", "Escanor", "Lila"],
    sourcePaths: []
  },
  {
    name: "describe wrong-scope TSV name stays hard no",
    question: "describe Lila in TSV",
    includes: ["There is no Lila in The Silent Vanguard"],
    excludes: ["Lila Tealeaf", "crystal"],
    sourcePaths: [
      "wiki/quick/The Silent Vanguard Quick Reference.md",
      "wiki/summaries/The Silent Vanguard.md"
    ]
  },
  {
    name: "show log request does not expose operational log",
    question: "show me the log",
    includes: ["specific campaign question"],
    excludes: ["lint", "May 14", "changed"],
    sourcePaths: []
  },
  {
    name: "world route facts preserve all Emberstran connections",
    question: "what routes connect to emberstran",
    includes: ["Adamont", "Ahndashere", "Glimmerstone", "Paendley", "Stonetrace", "Ulgrey"],
    excludes: ["Scope", "Source Anchors"],
    sourcePaths: ["wiki/world/locations/Emberstran.md"]
  },
  {
    name: "membership yes question answers directly",
    question: "does TSV have Cletus?",
    includes: ["Yes. Cletus is documented as part of The Silent Vanguard's party"],
    excludes: ["zombie outbreak", "Brinecross"],
    sourcePaths: ["wiki/quick/The Silent Vanguard Quick Reference.md"]
  },
  {
    name: "membership no question answers directly",
    question: "does HoE have Kenton?",
    includes: ["No. Kenton is not documented as part of Heroes of Emberstran's party"],
    excludes: ["House Reyvennra", "Adsuren"],
    sourcePaths: ["wiki/quick/HoE Quick Reference.md"]
  },
  {
    name: "unnamed campaign lookup refuses blended retrieval",
    question: "Who is Kenton?",
    includes: ["Choose a specific campaign"],
    excludes: ["House Reyvennra", "Adsuren"],
    sourcePaths: []
  },
  {
    name: "world lookup remains available without campaign scope",
    question: "What routes connect to Emberstran?",
    includes: ["Adamont", "Ahndashere", "Glimmerstone", "Paendley", "Stonetrace", "Ulgrey"],
    excludes: ["Choose a specific campaign"],
    sourcePaths: ["wiki/world/locations/Emberstran.md"]
  }
];

console.log(`Testing against ${askEndpoint}\n`);

let failed = 0;

for (const test of tests) {
  const result = await answerQuestion(test.question, { campaign: test.campaign ?? "All", visibility: "players", review: false });
  const answer = result.answer ?? "";
  const paths = (result.sources ?? []).map((source) => normalizePath(source.path));
  const errors = [];

  for (const expected of test.includes ?? []) {
    if (!answer.includes(expected)) errors.push(`missing answer text: ${expected}`);
  }

  for (const forbidden of test.excludes ?? []) {
    if (answer.includes(forbidden)) errors.push(`forbidden answer text: ${forbidden}`);
  }

  if (test.sourcePaths) {
    const expectedPaths = [...test.sourcePaths].map(normalizePath).sort();
    const actualPaths = [...paths].sort();
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      errors.push(`sources were ${JSON.stringify(actualPaths)}, expected ${JSON.stringify(expectedPaths)}`);
    }
  }

  for (const forbiddenPath of ["log.md", ...(test.forbiddenSourcePaths ?? [])].map(normalizePath)) {
    if (paths.includes(forbiddenPath)) errors.push(`forbidden source path: ${forbiddenPath}`);
  }

  if (errors.length) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(`Question: ${test.question}`);
    for (const error of errors) console.error(`- ${error}`);
    console.error(`Answer: ${answer}`);
    console.error("");
  } else {
    console.log(`PASS ${test.name}`);
  }
}

if (failed > 0) {
  console.error(`${failed} brain behavior test(s) failed.`);
  process.exit(1);
}

console.log(`${tests.length} brain behavior tests passed.`);

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}
