import fs from "node:fs/promises";
import path from "node:path";
import { brainConfig } from "./config";
import { chat, chatStream, embedTexts } from "./ai-client";
import { loadIndex, searchIndex } from "./vector-store";
import type { IndexItem, BrainIndex, PageEntry } from "./vector-store";
import { lookupCache, storeCache } from "./query-cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueryOptions {
  campaign?: string;
  visibility?: string;
  topK?: number;
  answerMode?: string;
  review?: boolean;
  debug?: boolean;
}

export interface QuerySource {
  title: string;
  path: string;
  heading?: string;
  campaign?: string;
  score?: number;
  semanticScore?: number;
  lexicalScore?: number;
  directScore?: number;
}

export interface QueryResult {
  answer: string;
  sources: QuerySource[];
  fromCache?: true;
  debug?: unknown;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (sources: QuerySource[], debug: unknown, answer: string) => void;
}

interface QueryScope {
  retrievalCampaign: string;
  promptCampaign: string;
  selectedCampaign: string;
  crossCampaign: boolean;
  worldCrossCampaign: boolean;
  requiresCampaign: boolean;
}

interface QueryIntent {
  relationshipQuestion: boolean;
  identityQuestion: boolean;
  threadQuestion: boolean;
  storyRecapQuestion: boolean;
  comparativeQuestion: boolean;
  dmAnalysisQuestion: boolean;
}

interface CampaignDef {
  code: string;
  name: string;
  indexName: string;
  aliases: string[];
}

interface RosterMember {
  character: string;
  player: string;
  species: string;
  className: string;
}

interface CampaignRoster {
  campaign: string;
  sourceTitle: string;
  sourcePath: string;
  members: RosterMember[];
}

interface StructuredLookup {
  title: string;
  sourceTitle: string;
  path: string;
  heading: string;
  limit: number;
}

interface RelationshipTone {
  intro: (first: string, second: string) => string;
  close: (first: string, second: string) => string;
}

// ─── Campaign Data ────────────────────────────────────────────────────────────

// Used by systemPrompt / acronym answers (mirrors campaigns.mjs — 5 campaigns)
const campaignsForLine: CampaignDef[] = [
  { code: "HoE", name: "Heroes of Emberstran", indexName: "HoE", aliases: ["heroes of emberstran"] },
  { code: "SoD", name: "Souls of Destiny", indexName: "SoD", aliases: ["souls of destiny"] },
  { code: "TSV", name: "The Silent Vanguard", indexName: "The Silent Vanguard", aliases: ["the silent vanguard", "silent vanguard"] },
  { code: "WB", name: "Bloody Endeavor", indexName: "Bloody Endeavor", aliases: ["bloody endeavor", "wyrm bane"] },
  { code: "D3", name: "Dungeons III", indexName: "Dungeons III", aliases: ["dungeons iii", "dungeons 3", "d3"] },
];

function campaignLine(): string {
  return campaignsForLine.map((c) => `${c.code} (${c.name})`).join(", ");
}

function resolveCampaignAcronym(value: string): CampaignDef | undefined {
  const normalized = String(value).trim().toLowerCase();
  return campaignsForLine.find(
    (c) => c.code.toLowerCase() === normalized || c.aliases.includes(normalized),
  );
}

// Full lookup map including TCB (used by routing / roster / scope resolution)
const campaignsByCode: Record<string, CampaignDef> = {
  HoE: { code: "HoE", name: "Heroes of Emberstran", indexName: "HoE", aliases: ["heroes of emberstran", "heart of emberstran", "hoe"] },
  SoD: { code: "SoD", name: "Souls of Destiny", indexName: "SoD", aliases: ["souls of destiny", "sod"] },
  TSV: { code: "TSV", name: "The Silent Vanguard", indexName: "The Silent Vanguard", aliases: ["the silent vanguard", "silent vanguard", "tsv"] },
  WB: { code: "WB", name: "Bloody Endeavor", indexName: "Bloody Endeavor", aliases: ["bloody endeavor", "wyrm bane", "wb"] },
  D3: { code: "D3", name: "Dungeons III", indexName: "Dungeons III", aliases: ["dungeons iii", "dungeons 3", "d3"] },
  TCB: { code: "TCB", name: "The Crystal Bottle", indexName: "The Crystal Bottle", aliases: ["the crystal bottle", "crystal bottle", "tcb"] },
};

const entityAliases: Record<string, string> = {
  aury: "Aurelius",
  lenny: "Lensworth",
  pagern: "Pagern",
  kytha: "Ky'tha",
  "ky tha": "Ky'tha",
};

const campaignRosters: Record<string, CampaignRoster> = {
  HoE: {
    campaign: "HoE",
    sourceTitle: "HoE Quick Reference",
    sourcePath: "wiki/quick/HoE Quick Reference.md",
    members: [
      { character: "Ainslie", player: "Sean Poole", species: "Unknown", className: "Unknown" },
      { character: "Aurelius", player: "Larry McHale", species: "Unknown", className: "Unknown" },
      { character: "Hap", player: "Ty Cooper", species: "Unknown", className: "Unknown" },
      { character: "Ky'tha", player: "Lesley Poole", species: "Unknown", className: "Unknown" },
      { character: "Og", player: "Joshua John", species: "Unknown", className: "Unknown" },
      { character: "Zymve", player: "Emma Cooper", species: "Unknown", className: "Unknown" },
    ],
  },
  SoD: {
    campaign: "SoD",
    sourceTitle: "SoD Quick Reference",
    sourcePath: "wiki/quick/SoD Quick Reference.md",
    members: [
      { character: "Escanor", player: "Brian Winniford", species: "Unknown", className: "Unknown" },
      { character: "Therric", player: "Chip Poole", species: "Unknown", className: "Unknown" },
      { character: "Zephyra", player: "Jenny McHale", species: "Unknown", className: "Fiendish heritage / Tiefling" },
      { character: "Kenton", player: "Larry McHale", species: "Unknown", className: "Unknown" },
      { character: "Esylla", player: "Lesley Poole", species: "Unknown", className: "Unknown" },
      { character: "Lila", player: "Tiffany", species: "Unknown", className: "Unknown" },
    ],
  },
  TSV: {
    campaign: "The Silent Vanguard",
    sourceTitle: "The Silent Vanguard Quick Reference",
    sourcePath: "wiki/quick/The Silent Vanguard Quick Reference.md",
    members: [
      { character: "Cletus", player: "Brian", species: "Human", className: "Cleric" },
      { character: "Lensworth", player: "Tom", species: "Human", className: "Barbarian" },
      { character: "Jett Blackwood", player: "Larry McHale", species: "Human", className: "Fighter" },
      { character: "Axel Blackwood", player: "Larry McHale", species: "Unknown", className: "Unknown" },
    ],
  },
  WB: {
    campaign: "Bloody Endeavor",
    sourceTitle: "Bloody Endeavor Quick Reference",
    sourcePath: "wiki/quick/Bloody Endeavor Quick Reference.md",
    members: [
      { character: "Albross", player: "Cooper", species: "Pink Tiefling", className: "Warlock (Celestial)" },
      { character: "Caelion", player: "Chuck", species: "Aasimar", className: "Cleric (Life)" },
      { character: "Lucerion", player: "Chip", species: "Elf", className: "Paladin (Glory)" },
      { character: "Pagern Stonebuckle", player: "Tom", species: "Gnome", className: "Wizard (Evoker)" },
      { character: "Rhody Falco", player: "Josh", species: "Human", className: "Ranger (Fey Wanderer)" },
    ],
  },
  D3: {
    campaign: "Dungeons III",
    sourceTitle: "Dungeons III Quick Reference",
    sourcePath: "wiki/quick/Dungeons III Quick Reference.md",
    members: [
      { character: "Meles", player: "Brian", species: "Wood Elf", className: "Rogue" },
      { character: "Draelith", player: "Chip", species: "Human", className: "Wizard" },
      { character: "Nixie", player: "Chuck", species: "Deep Gnome", className: "Druid" },
      { character: "Seraphine Veyne", player: "Suzanne", species: "Aasimar", className: "Cleric" },
      { character: "Nova", player: "Tiff", species: "Aasimar", className: "Bard" },
      { character: "Aeon", player: "Tom", species: "Half Elf", className: "Fighter" },
    ],
  },
};

// ─── Public Exports ───────────────────────────────────────────────────────────

export async function retrieve(question: string, options: QueryOptions = {}): Promise<IndexItem[]> {
  const scope = resolveQueryScope(question, options);
  const [queryEmbedding] = await embedTexts([question]);
  const index = await loadIndex();
  const semanticMatches = searchIndex(index, queryEmbedding, {
    topK: Math.max((options.topK ?? brainConfig.topK) * 4, 32),
    campaign: scope.retrievalCampaign,
    visibility: options.visibility ?? "players",
    queryText: question,
  });

  const expandedMatches = expandEntityMatches(index, semanticMatches, question, {
    campaign: scope.retrievalCampaign,
    visibility: options.visibility ?? "players",
  });

  const coMentionMatches = expandCoMentionMatches(index, expandedMatches, question, {
    campaign: scope.retrievalCampaign,
    visibility: options.visibility ?? "players",
  });

  const graphMatches = expandGraphMatches(index, coMentionMatches, question, {
    campaign: scope.retrievalCampaign,
    visibility: options.visibility ?? "players",
  });

  return rerankMatches(question, graphMatches);
}

export async function answerQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult> {
  const conversationalAnswer = answerConversationalPrompt(question, options);
  if (conversationalAnswer) return finalizeResult(conversationalAnswer);

  const operationalLogAnswer = answerOperationalLogQuestion(question);
  if (operationalLogAnswer) return finalizeResult(operationalLogAnswer);

  const acronymAnswer = answerAcronymQuestion(question);
  if (acronymAnswer) return finalizeResult(acronymAnswer);

  const missingCampaignScopeAnswer = answerMissingCampaignScopeQuestion(question, options);
  if (missingCampaignScopeAnswer) return finalizeResult(missingCampaignScopeAnswer);

  const scopedNameGuardAnswer = answerScopedNameGuardQuestion(question, options);
  if (scopedNameGuardAnswer) return finalizeResult(scopedNameGuardAnswer);

  const rosterPlayerAnswer = answerRosterPlayerQuestion(question, options);
  if (rosterPlayerAnswer) return finalizeResult(rosterPlayerAnswer);

  const rosterAliasIdentityAnswer = answerRosterAliasIdentityQuestion(question, options);
  if (rosterAliasIdentityAnswer) return finalizeResult(rosterAliasIdentityAnswer);

  const sourceRequestAnswer = await answerSourceRequestQuestion(question, options);
  if (sourceRequestAnswer) return finalizeResult(sourceRequestAnswer);

  const rosterMembershipAnswer = answerRosterMembershipQuestion(question, options);
  if (rosterMembershipAnswer) return finalizeResult(rosterMembershipAnswer);

  const rosterAnswer = await answerRosterQuestion(question, options);
  if (rosterAnswer) return finalizeResult(rosterAnswer);

  const latestSessionAnswer = await answerLatestSessionQuestion(question, options);
  if (latestSessionAnswer) return finalizeResult(latestSessionAnswer);

  const structuredIndexAnswer = await answerStructuredIndexQuestion(question, options);
  if (structuredIndexAnswer) return finalizeResult(structuredIndexAnswer);

  const outOfScopeEntityAnswer = await answerOutOfScopeEntityQuestion(question, options);
  if (outOfScopeEntityAnswer) return finalizeResult(outOfScopeEntityAnswer);

  const invalidRelationshipAnswer = await answerInvalidRelationshipQuestion(question, options);
  if (invalidRelationshipAnswer) return finalizeResult(invalidRelationshipAnswer);

  const unknownEntityAnswer = await answerUnknownEntityQuestion(question, options);
  if (unknownEntityAnswer) return finalizeResult(unknownEntityAnswer);

  const worldAnswer = await answerExactWorldQuestion(question, options);
  if (worldAnswer) return finalizeResult(worldAnswer);

  const documentedRelationshipAnswer = await answerDocumentedRelationshipQuestion(question, options);
  if (documentedRelationshipAnswer) return finalizeResult(documentedRelationshipAnswer);

  const cached = await lookupCache(question, options);
  if (cached) return finalizeResult(cached);

  const scope = resolveQueryScope(question, options);
  const retrievedMatches = await retrieve(question, options);
  const relationshipQuestion = isRelationshipQuestion(question);
  const threadQuestion = isThreadQuestion(question);
  const storyRecapQuestion = options.answerMode === "recap" || isStoryRecapQuestion(question);
  const comparativeQuestion = isSuperlativeWorldQuestion(question);
  const identityQuestion = isIdentityQuestion(question) && !relationshipQuestion && !threadQuestion && !storyRecapQuestion && !comparativeQuestion;
  const dmAnalysisQuestion = options.answerMode === "analysis";
  const intent: QueryIntent = { relationshipQuestion, identityQuestion, threadQuestion, storyRecapQuestion, comparativeQuestion, dmAnalysisQuestion };
  const matches = curateMatchesForAnswer(retrievedMatches, question, { relationshipQuestion, identityQuestion, threadQuestion, storyRecapQuestion });
  const context = renderContext(matches);

  const draft = await chat([
    { role: "system", content: systemPrompt(intent, scope).join(" ") },
    {
      role: "user",
      content: [
        `Vault excerpts:\n${context}`,
        "",
        `Selected campaign: ${scope.promptCampaign}`,
        `Question: ${question}`,
        relationshipQuestion ? "Cover the relationship between these people — what they mean to each other, what they know or suspect, any tensions or bonds, and how each one sees the other." : "",
        identityQuestion ? "Introduce this person fully — their presence in the world, their role, what drives them, their key relationships, and anything that currently hangs over them." : "",
        threadQuestion ? "Recount this thread — what has been established, where it stands right now, what leads exist, what remains unresolved, and why it matters." : "",
        comparativeQuestion ? "List candidates from the excerpts. For each, label them with their actual campaign name (e.g., Heroes of Emberstran) or 'World lore' — never use 'All' as a label. Do not connect or compare characters across campaigns — they are in separate stories." : "",
        storyRecapQuestion ? "Story / Recap Mode is active. Start with 'Short version:' and the direct answer in one sentence. Then write 'Story recap:' and give the table-ready recap in compact narrative prose." : "",
        storyRecapQuestion ? "Use exactly those two labels and no other headers. Do not use lists or tables; fold unresolved threads into the recap prose." : "Answer first. Keep specific lookup questions concise. Use bullets only if they make the answer easier to scan. No tables.",
      ].filter((part) => part !== "").join("\n"),
    },
  ]);

  const reviewEnabled = options.review ?? brainConfig.answerReviewEnabled;
  const answer = reviewEnabled ? await reviewAnswer(question, draft, context, intent, scope) : draft;
  const displayAnswer = appendSourceAnchors(cleanAnswerForDisplay(answer), matches);

  const result: QueryResult = { answer: displayAnswer, sources: matches.map(sourceFromMatch) };
  if (options.debug) result.debug = buildDebugTrace(question, scope, intent, retrievedMatches, matches);
  storeCache(question, options, result).catch(() => {});
  return result;
}

export async function streamAnswer(
  question: string,
  options: QueryOptions = {},
  callbacks: StreamCallbacks = {},
): Promise<void> {
  function emitImmediate(result: QueryResult): void {
    const finalized = finalizeResult(result);
    callbacks.onToken?.(finalized.answer);
    callbacks.onDone?.(finalized.sources, null, finalized.answer);
  }

  const conversationalAnswer = answerConversationalPrompt(question, options);
  if (conversationalAnswer) { emitImmediate(conversationalAnswer); return; }

  const operationalLogAnswer = answerOperationalLogQuestion(question);
  if (operationalLogAnswer) { emitImmediate(operationalLogAnswer); return; }

  const acronymAnswer = answerAcronymQuestion(question);
  if (acronymAnswer) { emitImmediate(acronymAnswer); return; }

  const missingCampaignScopeAnswer = answerMissingCampaignScopeQuestion(question, options);
  if (missingCampaignScopeAnswer) { emitImmediate(missingCampaignScopeAnswer); return; }

  const scopedNameGuardAnswer = answerScopedNameGuardQuestion(question, options);
  if (scopedNameGuardAnswer) { emitImmediate(scopedNameGuardAnswer); return; }

  const rosterPlayerAnswer = answerRosterPlayerQuestion(question, options);
  if (rosterPlayerAnswer) { emitImmediate(rosterPlayerAnswer); return; }

  const rosterAliasIdentityAnswer = answerRosterAliasIdentityQuestion(question, options);
  if (rosterAliasIdentityAnswer) { emitImmediate(rosterAliasIdentityAnswer); return; }

  const sourceRequestAnswer = await answerSourceRequestQuestion(question, options);
  if (sourceRequestAnswer) { emitImmediate(sourceRequestAnswer); return; }

  const rosterMembershipAnswer = answerRosterMembershipQuestion(question, options);
  if (rosterMembershipAnswer) { emitImmediate(rosterMembershipAnswer); return; }

  const rosterAnswer = await answerRosterQuestion(question, options);
  if (rosterAnswer) { emitImmediate(rosterAnswer); return; }

  const latestSessionAnswer = await answerLatestSessionQuestion(question, options);
  if (latestSessionAnswer) { emitImmediate(latestSessionAnswer); return; }

  const structuredIndexAnswer = await answerStructuredIndexQuestion(question, options);
  if (structuredIndexAnswer) { emitImmediate(structuredIndexAnswer); return; }

  const outOfScopeEntityAnswer = await answerOutOfScopeEntityQuestion(question, options);
  if (outOfScopeEntityAnswer) { emitImmediate(outOfScopeEntityAnswer); return; }

  const invalidRelationshipAnswer = await answerInvalidRelationshipQuestion(question, options);
  if (invalidRelationshipAnswer) { emitImmediate(invalidRelationshipAnswer); return; }

  const unknownEntityAnswer = await answerUnknownEntityQuestion(question, options);
  if (unknownEntityAnswer) { emitImmediate(unknownEntityAnswer); return; }

  const worldAnswer = await answerExactWorldQuestion(question, options);
  if (worldAnswer) { emitImmediate(worldAnswer); return; }

  const documentedRelationshipAnswer = await answerDocumentedRelationshipQuestion(question, options);
  if (documentedRelationshipAnswer) { emitImmediate(documentedRelationshipAnswer); return; }

  const cached = await lookupCache(question, options);
  if (cached) { emitImmediate(cached); return; }

  const scope = resolveQueryScope(question, options);
  const retrievedMatches = await retrieve(question, options);
  const relationshipQuestion = isRelationshipQuestion(question);
  const threadQuestion = isThreadQuestion(question);
  const storyRecapQuestion = options.answerMode === "recap" || isStoryRecapQuestion(question);
  const comparativeQuestion = isSuperlativeWorldQuestion(question);
  const identityQuestion = isIdentityQuestion(question) && !relationshipQuestion && !threadQuestion && !storyRecapQuestion && !comparativeQuestion;
  const dmAnalysisQuestion = options.answerMode === "analysis";
  const intent: QueryIntent = { relationshipQuestion, identityQuestion, threadQuestion, storyRecapQuestion, comparativeQuestion, dmAnalysisQuestion };
  const matches = curateMatchesForAnswer(retrievedMatches, question, { relationshipQuestion, identityQuestion, threadQuestion, storyRecapQuestion });
  const context = renderContext(matches);

  const messages = [
    { role: "system" as const, content: systemPrompt(intent, scope).join(" ") },
    {
      role: "user" as const,
      content: [
        `Vault excerpts:\n${context}`,
        "",
        `Selected campaign: ${scope.promptCampaign}`,
        `Question: ${question}`,
        relationshipQuestion ? "Cover only the documented relationship between these people. If direct evidence is sparse, say that plainly. Do not broaden into separate biographies or unrelated personal arcs unless the excerpts explicitly connect those facts to the relationship." : "",
        identityQuestion ? "Introduce this person fully — their presence in the world, their role, what drives them, their key relationships, and anything that currently hangs over them." : "",
        threadQuestion ? "Recount this thread — what has been established, where it stands right now, what leads exist, what remains unresolved, and why it matters." : "",
        comparativeQuestion ? "List candidates from the excerpts. For each, label them with their actual campaign name (e.g., Heroes of Emberstran) or 'World lore' — never use 'All' as a label. Do not connect or compare characters across campaigns — they are in separate stories." : "",
        storyRecapQuestion ? "Story / Recap Mode is active. Start with 'Short version:' and the direct answer in one sentence. Then write 'Story recap:' and give the table-ready recap in compact narrative prose." : "",
        storyRecapQuestion ? "Use exactly those two labels and no other headers. Do not use lists or tables; fold unresolved threads into the recap prose." : "Answer first. Keep specific lookup questions concise. Use bullets only if they make the answer easier to scan. No tables.",
      ].filter((part) => part !== "").join("\n"),
    },
  ];

  let fullAnswer = "";
  for await (const token of chatStream(messages)) {
    fullAnswer += token;
    callbacks.onToken?.(token);
  }

  const finalSources = matches.map(sourceFromMatch);
  const finalAnswer = appendSourceAnchors(cleanAnswerForDisplay(fullAnswer), matches);

  if (fullAnswer) {
    storeCache(question, options, { answer: finalAnswer, sources: finalSources }).catch(() => {});
  }

  callbacks.onDone?.(
    finalSources,
    options.debug ? buildDebugTrace(question, scope, intent, retrievedMatches, matches) : null,
    finalAnswer,
  );
}

// ─── Context / Answer Helpers ─────────────────────────────────────────────────

function renderContext(matches: IndexItem[]): string {
  return matches
    .map((match, index) =>
      [
        `Source ${index + 1}`,
        `Title: ${match.metadata.title}`,
        `Campaign: ${match.metadata.campaign}`,
        `Path: ${match.metadata.path}`,
        `Heading: ${match.metadata.heading}`,
        `Text:`,
        match.text,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

async function reviewAnswer(
  question: string,
  draft: string,
  context: string,
  intent: QueryIntent,
  scope: QueryScope,
): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content: [
          ...systemPrompt(intent, scope),
          "You are doing a final pass on a draft answer. Your job is two things: facts and voice.",
          "Facts: add anything important the draft missed that is in the excerpts, especially active complications and unresolved threads. Remove any claim not supported by the excerpts — this includes invented emotional states, motivations, fears, personality traits, and atmospheric details that aren't documented. Fix any reversed relationships or directionality errors.",
          "Voice: read every sentence and ask — does this sound like a great DM said it, and is it grounded in what actually happened? Cut invented drama. Cut generic filler. Sharpen anything vague. If the excerpts only support a short answer, make it a short answer — honest and vivid beats long and fabricated. Specific questions should answer first and stay concise. Story / Recap Mode may be narrative, but it must start with the short answer.",
          "Return only the revised answer. No critique, no preamble.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${question}`,
          `Selected campaign: ${scope.promptCampaign}`,
          intent.relationshipQuestion ? "Speak as a DM in flowing prose. Describe only the documented relationship between these characters. If the excerpts show a loose party bond rather than a deep relationship, keep the answer short and say that. No bullet points or headers." : "",
          intent.identityQuestion ? "Speak as a DM introducing this character to the players. Use flowing prose — no bullet points, no labeled fields, no headers. Paint a picture of who they are, their role in the party, their personality, goals, and any active complications hanging over them." : "",
          intent.threadQuestion ? "Speak as a DM recapping this plot thread at the table. Describe what is known, what leads exist, what remains unresolved, and why it matters — in flowing prose, not a list." : "",
          intent.storyRecapQuestion ? "Keep Story / Recap Mode. Start with 'Short version:' and the answer in one sentence. Then use 'Story recap:' for the narrative. Use exactly those two labels and no other headers. Do not use lists; fold complications and unresolved threads into the prose." : "",
          "",
          `Draft answer:\n${draft}`,
          "",
          `Vault excerpts:\n${context}`,
        ]
          .filter((part) => part !== "")
          .join("\n"),
      },
    ],
    { temperature: 0.1 },
  );
}

function cleanAnswerForDisplay(answer: string): string {
  return String(answer ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*[-*]\s*Source\s+\d+\b/i.test(line))
    .join("\n")
    .replace(/\n\n[ \t]+/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function finalizeResult(result: QueryResult): QueryResult {
  return {
    ...result,
    answer: appendSourceAnchors(result.answer, result.sources ?? []),
  };
}

function sourceFromMatch(match: IndexItem): QuerySource {
  return {
    title: match.metadata.title,
    path: match.metadata.path,
    heading: match.metadata.heading,
    campaign: match.metadata.campaign,
    score: Number((match.score ?? 0).toFixed(4)),
    semanticScore: Number((match.semanticScore ?? 0).toFixed(4)),
    lexicalScore: Number((match.lexicalScore ?? 0).toFixed(4)),
    directScore: Number((match.directScore ?? 0).toFixed(4)),
  };
}

function appendSourceAnchors(answer: string, matches: (IndexItem | QuerySource)[]): string {
  const cleaned = cleanAnswerForDisplay(answer);
  const anchors = sourceAnchors(matches);
  if (!cleaned || !anchors.length || /\n\s*(?:Sources used|Source anchors):/i.test(cleaned)) return cleaned;
  return `${cleaned}\n\nSources used: ${anchors.join("; ")}.`;
}

function sourceAnchors(matches: (IndexItem | QuerySource)[], limit = 4): string[] {
  const seen = new Set<string>();
  const anchors: string[] = [];
  for (const match of matches) {
    const metadata = (match as IndexItem).metadata ?? (match as QuerySource);
    const title = (metadata as { title: string }).title;
    const heading = (metadata as { heading?: string }).heading;
    if (!title || isAnswerMaintenanceHeading(heading ?? "")) continue;
    const label = heading && normalize(heading) !== "summary" ? `${title}, ${heading}` : title;
    const key = normalize(label);
    if (seen.has(key)) continue;
    anchors.push(`[[${title}|${label}]]`);
    seen.add(key);
    if (anchors.length >= limit) break;
  }
  return anchors;
}

function buildDebugTrace(
  question: string,
  scope: QueryScope,
  intent: QueryIntent,
  retrievedMatches: IndexItem[],
  selectedMatches: IndexItem[],
): unknown {
  return {
    question,
    scope,
    intent,
    retrievedCount: retrievedMatches.length,
    selectedCount: selectedMatches.length,
    selected: selectedMatches.map((match) => ({
      title: match.metadata.title,
      path: match.metadata.path,
      heading: match.metadata.heading,
      campaign: match.metadata.campaign,
      score: Number((match.score ?? 0).toFixed(4)),
      semanticScore: Number((match.semanticScore ?? 0).toFixed(4)),
      lexicalScore: Number((match.lexicalScore ?? 0).toFixed(4)),
      directScore: Number((match.directScore ?? 0).toFixed(4)),
    })),
  };
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function systemPrompt(intent: QueryIntent = {} as QueryIntent, scope: QueryScope = resolveQueryScope("", {})): string[] {
  const prompt = [
    "Answer the question about this tabletop RPG campaign. Use ONLY the vault excerpts supplied in the user message — no inference, no invention, nothing beyond what is explicitly written. If the answer is not in the excerpts, say so.",
    "Do not roleplay as any player character. You are not Kenton, not Escanor, not Aurelius, not any named character. You are the narrator describing the world. Refer to all characters — including player characters — in third person: 'Kenton did X', 'Almadia runs the tannery', never 'you are Kenton' or 'you are the tanner'.",
    "Iron rule: answer only from what the excerpts explicitly state. If the excerpts mark something as an inference or unconfirmed, present it as uncertain. Do not add emotional states, motivations, fears, or atmosphere that are not documented. Do not speculate. Do not pad a short answer with invented texture.",
    `The campaigns are ${campaignLine()}. These are separate worlds — never bleed information from one into another unless the excerpts explicitly connect them.`,
    scope.worldCrossCampaign
      ? "This is a world-level question that can draw on documented events from multiple campaigns. Keep each campaign's events attributed to that campaign, and do not merge separate party histories into one story."
      : scope.retrievalCampaign === "All"
        ? "The current scope is All campaigns. Use cross-campaign information only when the question explicitly asks across all campaigns; otherwise keep the answer limited to the campaign named in the question, if any."
        : `The selected campaign scope is ${scope.promptCampaign}. Treat this as the campaign the user is referring to even if the question is short or omits the campaign name. You may use shared world lore, but do not use characters, events, quests, or factions from other campaigns.`,
    "Preserve relationships and directionality exactly as stated. If A betrayed B, do not say B betrayed A.",
    "If the excerpts don't contain the answer, say so plainly.",
    "Never cite file paths, source numbers, or section headings. Do not write phrases like 'Source 1', 'Source 13', or 'the Summary section' in the answer; the app shows sources separately.",
    "Default style: answer the user's question in the first sentence, then add only the context needed to understand it. Keep the DM voice clear and grounded, but do not add a long atmospheric lead-in.",
    "Specific lookup questions like 'what is', 'what are', 'who is', 'where is', and 'does' should be brief: answer directly first, then give one to three supporting facts. Do not turn an item lookup into a character biography.",
    "Use present tense for the world as it stands and past tense for events that have happened. Use markdown bullets only when they make a specific answer easier to scan. Never use markdown tables.",
  ];

  if (intent.identityQuestion) {
    prompt.push(
      "You are introducing this person as a living presence at the table. Lead with who they are in the world — their bearing, their role, what drives them, what they want. Weave in the practical details (class, species, background, player, campaign) through the story of who they are, never as a checklist. End with what hangs over them right now.",
      "Do not omit complications, threats, or unresolved threads tied to this character when the excerpts include them — those are the hooks that make people real.",
    );
  }

  if (intent.relationshipQuestion) {
    prompt.push(
      "Describe this relationship using only what the excerpts document — shared history, documented tensions, known bonds, things one did to or for the other. Do not invent emotional subtext or motivations that aren't stated. Let the documented facts speak for themselves.",
    );
  }

  if (intent.threadQuestion) {
    prompt.push(
      "Speak about this thread with urgency — it is unresolved in the world right now. Lay out what is known, what remains in shadow, what leads exist, and what it might cost if left unaddressed. Do not omit open complications or active leads when the excerpts include them.",
    );
  }

  if (intent.storyRecapQuestion) {
    prompt.push(
      "Story / Recap Mode is active. Start with 'Short version:' followed by one direct sentence. Then write 'Story recap:' and give the table-ready recap in two to four compact paragraphs. Use exactly those two labels and no other headers. Do not use lists or tables; fold complications and unresolved threads into the prose. Keep the DM storyteller feel, but keep the answer skimmable and do not repeat yourself.",
    );
  }

  if (intent.dmAnalysisQuestion) {
    prompt.push(
      "DM Analysis Mode is active. Be explicit and scannable: give the direct answer first, then use compact bullets for evidence, open questions, risks, and table-useful implications. Do not invent hidden motives; mark uncertain synthesis as uncertain.",
    );
  }

  if (intent.comparativeQuestion) {
    prompt.push(
      "This is a cross-campaign comparative question. Search the excerpts for candidates from any campaign. For each candidate you name, label them with their actual campaign name (e.g., Heroes of Emberstran, Souls of Destiny) or 'World lore' if they come from world-level documentation — never use 'All' or 'All campaigns' as a label, as that is the search scope, not a campaign. Never present candidates from different campaigns as sharing a world or knowing each other. If the excerpts provide no documented candidates, say so plainly rather than inventing one. If candidates exist but the excerpts do not establish a clear ranking, present what is documented and say that no definitive answer is recorded.",
    );
  }

  return prompt;
}

// ─── Short-Circuit Answer Functions ──────────────────────────────────────────

function answerAcronymQuestion(question: string): QueryResult | null {
  const match = question.match(/\bwhat\s+(?:does|is)\s+([A-Za-z]{2,4})\s+(?:stand\s+for|mean)\??$/i);
  if (!match) return null;
  const campaign = resolveCampaignAcronym(match[1]);
  if (!campaign) return null;
  return {
    answer: `${campaign.code} stands for **${campaign.name}**.`,
    sources: [{
      title: "Overview",
      path: "wiki/overview.md",
      heading: "Campaign Status At A Glance",
      campaign: campaign.code === "TSV" ? "The Silent Vanguard" : campaign.code,
      score: 1,
    }],
  };
}

function answerOperationalLogQuestion(question: string): QueryResult | null {
  const normalized = normalizeLoose(question);
  if (!normalized) return null;
  const asksForChangeHistory =
    /\b(what|which|show|list|tell|summarize|recap)\b/.test(normalized) &&
    /\b(changed|change|changes|updated|updates|worked on|did you do|did we do|fixed|fixes)\b/.test(normalized) &&
    /\b(today|yesterday|may \d{1,2}|\d{4}-\d{2}-\d{2}|this session|last session|recently)\b/.test(normalized);
  if (!asksForChangeHistory) return null;
  return {
    answer: "I do not use the maintenance log for player-facing answers. Ask me about an in-world person, place, faction, item, session, quest, or thread, and I will answer from the wiki instead of the operational changelog.",
    sources: [],
  };
}

function answerConversationalPrompt(question: string, options: QueryOptions = {}): QueryResult | null {
  const normalized = normalizeLoose(question);
  if (!normalized) return null;

  if (/^(hello|hi|hey|howdy|yo|greetings|good morning|good afternoon|good evening)$/.test(normalized)) {
    return { answer: "Hello. Ask me something about a campaign, character, location, quest, or open thread and I will search the vault for it.", sources: [] };
  }

  if (/^(thanks|thank you|thank you very much|ok|okay|cool|great|nice)$/.test(normalized)) {
    return { answer: "You are welcome. Send me the next campaign question when you are ready.", sources: [] };
  }

  if (isLikelyOutsideGeneralKnowledgeQuestion(question)) {
    return { answer: "That question sits outside the campaign brain. I can answer from the vault about campaigns, characters, locations, quests, sessions, factions, artifacts, and world lore, but I should not invent a campaign answer for ordinary real-world trivia.", sources: [] };
  }

  if (!looksLikeCampaignQuestion(question, options)) {
    return { answer: "I need a specific campaign question to search the vault. Try asking about a character, place, quest, session, faction, artifact, or open thread.", sources: [] };
  }

  return null;
}

function looksLikeCampaignQuestion(question: string, options: QueryOptions = {}): boolean {
  const value = String(question ?? "").trim();
  if (hasCampaignSignal(value)) return true;
  if (hasCampaignDomainNoun(value)) return true;
  if (String(options.campaign ?? "All") !== "All" && isQuestionLike(value)) return true;
  const entityNames = extractEntityNames(value);
  if (entityNames.length && !isLikelyOutsideGeneralKnowledgeQuestion(value)) return true;
  return false;
}

function isQuestionLike(value: string): boolean {
  return /[?]/.test(value) || /\b(who|what|where|when|why|how|which|tell me|summarize|recap|list|show|find|search|explain|describe|does|do|did|is|are|was|were|can|could)\b/i.test(value);
}

function hasCampaignSignal(value: string): boolean {
  return /\b(HoE|SoD|D3|TSV|WB|Dungeons III|Dungeons 3|The Silent Vanguard|Silent Vanguard|Bloody Endeavor|Wyrm Bane|Heroes of Emberstran|Souls of Destiny|Myrdae|Oberra|O'?naren|Qal'dynn|Emberstran|Ahndashere|Basctdelm|Scarwatch|Nunglthil|Climbor|Gevakaln|Gibuldon|Adsuren|Kenton|Zephyra|Lila|Escanor|Therric|Esylla|Aurelius|Aeolenne|Mollywop)\b/i.test(value);
}

function hasCampaignDomainNoun(value: string): boolean {
  return /\b(campaign|character|player character|party|quest|session|faction|artifact|relic|god|pantheon|location|city|town|settlement|region|continent|world lore|thread|plot|arc|mystery|npc|villain|enemy|ally|roster|route|road)\b/i.test(value);
}

function isLikelyOutsideGeneralKnowledgeQuestion(question: string): boolean {
  const value = String(question ?? "").trim();
  if (!value || hasCampaignSignal(value)) return false;
  return /\b(capital of|president of|prime minister of|population of|weather in|stock price|exchange rate|translate\b|define\b|how far is|recipe for)\b/i.test(value);
}

function normalizeLoose(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ");
}

function resolveQueryScope(question: string, options: QueryOptions = {}): QueryScope {
  const selected = String(options.campaign ?? "All");

  if (isCrossCampaignWorldQuestion(question)) {
    return { retrievalCampaign: "All", promptCampaign: "World lore across campaigns", selectedCampaign: selected, crossCampaign: true, worldCrossCampaign: true, requiresCampaign: false };
  }

  if (isWorldOnlyQuestion(question)) {
    return { retrievalCampaign: "World", promptCampaign: "World lore", selectedCampaign: selected, crossCampaign: false, worldCrossCampaign: false, requiresCampaign: false };
  }

  if (selected && selected !== "All") {
    const campaign = resolveCampaignSelection(selected);
    if (campaign) {
      return { retrievalCampaign: campaign.indexName, promptCampaign: campaign.name, selectedCampaign: selected, crossCampaign: false, worldCrossCampaign: false, requiresCampaign: false };
    }
  }

  const mentionedCampaign = resolveQuestionCampaign(question, { campaign: "All" });
  if (mentionedCampaign && !shouldAnswerAcrossCampaigns(question, options)) {
    return { retrievalCampaign: mentionedCampaign.indexName, promptCampaign: mentionedCampaign.name, selectedCampaign: selected, crossCampaign: false, worldCrossCampaign: false, requiresCampaign: false };
  }

  if (!shouldAnswerAcrossCampaigns(question, options)) {
    return { retrievalCampaign: "Unscoped", promptCampaign: "No campaign selected", selectedCampaign: selected, crossCampaign: false, worldCrossCampaign: false, requiresCampaign: true };
  }

  return { retrievalCampaign: "All", promptCampaign: "All campaigns", selectedCampaign: selected, crossCampaign: true, worldCrossCampaign: false, requiresCampaign: false };
}

function answerMissingCampaignScopeQuestion(question: string, options: QueryOptions = {}): QueryResult | null {
  const scope = resolveQueryScope(question, options);
  if (!scope.requiresCampaign) return null;
  return { answer: "Choose a specific campaign, name the campaign in your question, or ask a world-lore question. I won't search across separate campaign histories unless the question is explicitly about the shared world or asks across campaigns.", sources: [] };
}

function answerScopedNameGuardQuestion(question: string, options: QueryOptions = {}): QueryResult | null {
  const normalizedQuestion = normalize(question);
  const guardedName = ["lila", "zephyra"].find((name) => normalizedQuestion.includes(name));
  if (!guardedName) return null;
  const campaign = resolveQuestionCampaign(question, options);
  if (!campaign || campaign.code === "SoD") return null;
  const displayName = guardedName === "lila" ? "Lila" : "Zephyra";
  return {
    answer: `There is no ${displayName} in ${campaign.name} in the current campaign brain. ${campaign.name}'s documented party is Cletus, Lensworth, Jett Blackwood, and Axel Blackwood.`,
    sources: [
      { title: "The Silent Vanguard Quick Reference", path: "wiki/quick/The Silent Vanguard Quick Reference.md", heading: "Active Party Members", campaign: "The Silent Vanguard", score: 1 },
      { title: "The Silent Vanguard", path: "wiki/summaries/The Silent Vanguard.md", heading: "Campaign Scope Notes", campaign: "The Silent Vanguard", score: 1 },
    ],
  };
}

function answerRosterPlayerQuestion(question: string, options: QueryOptions = {}): QueryResult | null {
  const campaign = resolveQuestionCampaign(question, options);
  const targetName = extractRosterTargetName(question);

  if (!campaign && targetName) {
    const matchesFound = Object.values(campaignsByCode)
      .filter((c) => campaignRosters[c.code])
      .map((c) => ({ campaign: c, roster: campaignRosters[c.code], member: findRosterMember(campaignRosters[c.code], targetName) }))
      .filter((m) => m.member);

    if (matchesFound.length === 1) {
      const m = matchesFound[0];
      return {
        answer: `${m.member!.player} plays ${m.member!.character} in ${m.campaign.name}.${characterDetailSentence(m.member!)}`,
        sources: [{ title: m.roster.sourceTitle, path: m.roster.sourcePath, heading: "Active Party Members", campaign: m.campaign.indexName, score: 1 }],
      };
    }
  }

  if (!campaign) return null;
  const roster = campaignRosters[campaign.code];
  if (!roster) return null;

  const normalizedQuestion = normalize(question);
  const playerMatches = roster.members.filter((member) => normalize(member.player) && normalizedQuestion.includes(normalize(member.player)));

  if (!playerMatches.length && /\blarry\b/i.test(question)) {
    const larryMatches = roster.members.filter((member) => /\bLarry\b/i.test(member.player));
    if (larryMatches.length) {
      const rows = larryMatches.map((member) => `${member.player} plays ${member.character}${characterDetailPhrase(member)}`).join("; ");
      return { answer: `In ${campaign.name}, ${rows}.`, sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }] };
    }
  }

  if (!playerMatches.length) return null;
  const rows = playerMatches.map((member) => `${member.player} plays ${member.character}${characterDetailPhrase(member)}`).join("; ");
  return { answer: `In ${campaign.name}, ${rows}.`, sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }] };
}

function answerRosterAliasIdentityQuestion(question: string, options: QueryOptions = {}): QueryResult | null {
  const campaign = resolveQuestionCampaign(question, options);
  if (!campaign) return null;

  const match = String(question).match(/\b(?:who|what)\s+(?:is|are|was|were)\s+([A-Z][A-Za-z' -]{1,60}?)(?:\s+(?:in|for|from)\s+(?:HoE|SoD|D3|TSV|WB|Dungeons III|Dungeons 3|The Silent Vanguard|Silent Vanguard|Bloody Endeavor|Wyrm Bane|Heroes of Emberstran|Souls of Destiny))?\??$/i);
  if (!match) return null;

  const rawName = match[1].replace(/[?.!,;:]+$/g, "").replace(/\b(in|from|for|about)\b.*$/i, "").replace(/^the\s+/i, "").trim();
  const canonicalName = canonicalEntityName(rawName);
  if (!rawName || normalize(rawName) === normalize(canonicalName)) return null;

  const roster = campaignRosters[campaign.code];
  if (!roster) return null;

  const member = findRosterMember(roster, canonicalName);
  if (!member) return null;

  return {
    answer: `${rawName} is ${member.character} in ${campaign.name}. ${member.player} plays ${member.character}${characterDetailPhrase(member)}.`,
    sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
  };
}

function answerRosterMembershipQuestion(question: string, options: QueryOptions = {}): QueryResult | null {
  const campaign = resolveQuestionCampaign(question, options);
  if (!campaign) return null;
  if (/^\s*who\b/i.test(question)) return null;
  if (!/\b((?:does|do)\b.+\bhave|party|roster|player\s+character|player-character|character|member|part of|in the party)\b/i.test(question)) return null;
  if (!/\b(does|is|are)\b/i.test(question) || !/\b(have|in|part of|member of)\b/i.test(question)) return null;

  const roster = campaignRosters[campaign.code];
  if (!roster) return null;

  const entityNames = extractEntityNames(question);
  const candidateName = entityNames.find((name) => !isCampaignReferenceName(name));
  if (!candidateName) return null;

  const member = findRosterMember(roster, candidateName);
  if (member) {
    return {
      answer: `Yes. ${member.character} is documented as part of ${campaign.name}'s party. ${member.player} plays ${member.character}${characterDetailPhrase(member)}.`,
      sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
    };
  }

  return {
    answer: `No. ${candidateName} is not documented as part of ${campaign.name}'s party. ${campaign.name}'s documented party is ${formatSeries(roster.members.map((m) => m.character))}.`,
    sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
  };
}

async function answerSourceRequestQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (!/\b(source|sources|where\s+does|where\s+is|what\s+source)\b/i.test(question)) return null;
  if (/\blog(?:\.md)?\b/i.test(question)) {
    return { answer: "I do not expose the maintenance log as a player-facing source. Ask for an in-world page, character, place, faction, item, session, or thread instead.", sources: [] };
  }

  const entityNames = extractEntityNames(question);
  if (entityNames.length !== 1) return null;

  const scope = resolveQueryScope(question, options);
  const index = await loadIndex();
  const pages = findEntityPages(index, entityNames[0])
    .filter((page) => scope.retrievalCampaign === "All" || page.campaign === scope.retrievalCampaign || page.campaign === "World" || isSharedWorldPath(page.path))
    .filter((page) => page.path !== "log.md")
    .slice(0, 5);

  if (!pages.length) {
    const scopeText = scope.retrievalCampaign === "All" ? "the current campaign brain" : scope.promptCampaign;
    return { answer: `${entityNames[0]} is not documented in ${scopeText}, so I do not have a player-facing source page for that claim.`, sources: [] };
  }

  return {
    answer: `${entityNames[0]} is documented in ${pages.map((p) => p.path).join(", ")}.`,
    sources: pages.map((page) => ({ title: page.title, path: page.path, heading: page.title, campaign: page.campaign, score: 1 })),
  };
}

async function answerOutOfScopeEntityQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  const scope = resolveQueryScope(question, options);
  if (scope.retrievalCampaign === "All" || scope.retrievalCampaign === "World") return null;
  if (isRelationshipQuestion(question) || isThreadQuestion(question)) return null;

  const entityNames = extractEntityNames(question);
  if (entityNames.length !== 1) return null;

  const index = await loadIndex();
  const entityName = normalize(entityNames[0]);
  const exactPages = Object.values(index.pages ?? {}).filter((page) => normalize(page.title) === entityName);
  if (!exactPages.length) return null;

  const inScope = exactPages.some((page) => page.campaign === scope.retrievalCampaign || page.campaign === "World" || isSharedWorldPath(page.path)) || isRosterCharacterInCampaign(entityNames[0], scope);
  if (inScope) return null;

  const otherCampaigns = [...new Set(exactPages.map((page) => page.campaign).filter(Boolean))].join(", ");
  return { answer: `${entityNames[0]} is not documented in ${scope.promptCampaign}. I found that name in ${otherCampaigns}, so I am not crossing it into the selected campaign.`, sources: [] };
}

async function answerUnknownEntityQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  const scope = resolveQueryScope(question, options);
  if (isRelationshipQuestion(question) || isThreadQuestion(question)) return null;

  const entityNames = extractEntityNames(question);
  if (entityNames.length !== 1) return null;

  const index = await loadIndex();
  const entityName = entityNames[0];
  const matchingPages = findEntityPages(index, entityName);

  if (!matchingPages.length) {
    const hasTextMention = index.items.some((item) => {
      if (!isAllowed(item, { campaign: scope.retrievalCampaign, visibility: options.visibility ?? "players" })) return false;
      return normalize(`${item.metadata.title} ${item.metadata.heading} ${item.text}`).includes(normalize(entityName));
    });
    if (hasTextMention) return null;
    const scopeText = scope.retrievalCampaign === "All" ? "the current campaign brain" : scope.promptCampaign;
    return { answer: `${entityName} is not documented in ${scopeText}. I should not invent a campaign answer for a name that is not in the wiki.`, sources: [] };
  }

  if (scope.retrievalCampaign !== "All" && scope.retrievalCampaign !== "World") {
    const inScope = matchingPages.some((page) => page.campaign === scope.retrievalCampaign || page.campaign === "World" || isSharedWorldPath(page.path)) || isRosterCharacterInCampaign(entityName, scope);
    if (!inScope) {
      const otherCampaigns = [...new Set(matchingPages.map((page) => page.campaign).filter(Boolean))].join(", ");
      return { answer: `${entityName} is not documented in ${scope.promptCampaign}. I found that name in ${otherCampaigns}, so I am not crossing it into the selected campaign.`, sources: [] };
    }
  }

  return null;
}

async function answerInvalidRelationshipQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (!hasRelationshipKeyword(question)) return null;
  const entityNames = extractEntityNames(question);
  if (entityNames.length < 2) return null;

  const scope = resolveQueryScope(question, options);
  const index = await loadIndex();
  const invalidNames: string[] = [];
  const outOfScopeNames: string[] = [];

  for (const entityName of entityNames.slice(0, 2)) {
    const pages = findEntityPages(index, entityName);
    if (!pages.length) { invalidNames.push(entityName); continue; }
    if (scope.retrievalCampaign !== "All" && scope.retrievalCampaign !== "World") {
      const inScope = pages.some((page) => page.campaign === scope.retrievalCampaign || page.campaign === "World" || isSharedWorldPath(page.path));
      if (!inScope) outOfScopeNames.push(entityName);
    }
  }

  if (!invalidNames.length && !outOfScopeNames.length) return null;

  const scopeText = scope.retrievalCampaign === "All" ? "the current campaign brain" : scope.promptCampaign;
  const parts: string[] = [];
  if (invalidNames.length) parts.push(`${formatSeries(invalidNames)} ${invalidNames.length === 1 ? "is" : "are"} not documented in ${scopeText}`);
  if (outOfScopeNames.length) parts.push(`${formatSeries(outOfScopeNames)} ${outOfScopeNames.length === 1 ? "is" : "are"} not documented in ${scopeText}`);

  return { answer: `${parts.join("; ")}. I should not invent a relationship unless both names are documented in the selected scope.`, sources: [] };
}

async function answerDocumentedRelationshipQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (!isRelationshipQuestion(question)) return null;
  const entityNames = extractEntityNames(question).slice(0, 2);
  if (entityNames.length < 2) return null;

  const [firstName, secondName] = entityNames;
  const scope = resolveQueryScope(question, options);
  const index = await loadIndex();
  const facts: string[] = [];
  const seenFacts = new Set<string>();
  const seenSourceIds = new Set<string>();
  const sources: QuerySource[] = [];

  for (const item of index.items) {
    if (!isAllowed(item, { campaign: scope.retrievalCampaign, visibility: options.visibility ?? "players" })) continue;
    if (!isRelationshipEvidenceHeading(item.metadata.heading)) continue;

    const title = normalize(item.metadata.title);
    const first = normalize(firstName);
    const second = normalize(secondName);
    const pageIsFirst = title === first || title.startsWith(`${first} `);
    const pageIsSecond = title === second || title.startsWith(`${second} `);
    const text = stripMarkdownHeadings(item.text);
    const normalizedText = normalize(text);

    if (!((pageIsFirst && normalizedText.includes(second)) || (pageIsSecond && normalizedText.includes(first)))) continue;

    for (const line of extractRelationshipFactLines(text, firstName, secondName, pageIsFirst ? secondName : pageIsSecond ? firstName : null)) {
      const fact = cleanFactLine(line);
      const factKey = normalize(fact);
      if (!fact || seenFacts.has(factKey)) continue;
      facts.push(fact);
      seenFacts.add(factKey);
      if (!seenSourceIds.has(item.id)) {
        sources.push({ title: item.metadata.title, path: item.metadata.path, heading: item.metadata.heading, campaign: item.metadata.campaign, score: 1 });
        seenSourceIds.add(item.id);
      }
      if (facts.length >= 6) break;
    }
    if (facts.length >= 6) break;
  }

  if (!facts.length) return null;

  const tone = relationshipToneFromFacts(facts, firstName, secondName);
  return {
    answer: [tone.intro(firstName, secondName), facts.map((fact) => sentenceFromFact(fact)).join(" "), tone.close(firstName, secondName)].join(" "),
    sources,
  };
}

async function answerExactWorldQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (isSuperlativeWorldQuestion(question)) return null;
  const scope = resolveQueryScope(question, options);
  if (scope.worldCrossCampaign) return null;
  if (scope.retrievalCampaign !== "World" && scope.selectedCampaign !== "All") return null;

  const index = await loadIndex();
  const normalizedQuestion = normalize(question);
  const worldPages = Object.values(index.pages ?? {}).filter((p) => p.campaign === "World");
  const aliasTitle = normalizedQuestion.includes("myrdae stories and tales") ? "myths and tales of myrdae" : null;
  const page = worldPages
    .sort((a, b) => b.title.length - a.title.length)
    .find((p) => normalize(p.title) === aliasTitle || normalizedQuestion.includes(normalize(p.title)));
  if (!page) return null;

  const routeQuestion = /\b(route|routes|road|roads|connect|connects|connected|connection|connections|travel|path|paths)\b/i.test(question);
  const leadershipQuestion = /\b(lead|leads|leader|leaders|rule|rules|ruler|govern|governs|government|lord|lady|captain|elder|council|magistrate|warden)\b/i.test(question);

  const exactWorldHeadings = routeQuestion
    ? ["route connections", "map metadata", "overview", "summary"]
    : leadershipQuestion
      ? ["government", "notable people", "law", "laws", "law and enforcement", "overview", "summary"]
      : ["overview", "summary", "known continents", "known continents regions", "history", "citizenry", "citizenry and enclaves", "traditions", "law", "laws", "map locations", "layout", "moons", "lunar facets", "regional model", "major regions", "region notes", "governance", "government", "harmon order", "harmons", "seasons", "major species", "unique myrdaen species", "recommended species", "common dialects", "well-known organizations", "recruitable adventurer-facing factions", "major tales", "mythic history", "prophecy", "bistron incident", "osanna tale", "morn of dunduar", "refounding", "laztyr incident", "diverra's ascension", "economy and trade", "law and enforcement", "districts and citizenry", "holidays and traditions", "religion", "map metadata", "route connections", "notable locations", "notable people", "core world pages"];

  const chunks = index.items
    .filter((item) => item.metadata.path === page.path)
    .filter((item) => exactWorldHeadings.includes(normalize(item.metadata.heading)))
    .sort((a, b) => exactWorldHeadings.indexOf(normalize(a.metadata.heading)) - exactWorldHeadings.indexOf(normalize(b.metadata.heading)))
    .slice(0, 6);

  if (!chunks.length) return null;

  const exactContext = chunks.map((chunk) => stripMarkdownHeadings(chunk.text)).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  const answer = routeQuestion
    ? narrateRouteConnections(page.title, exactContext)
    : await narrateExactWorldAnswer(question, exactContext, { routeQuestion, leadershipQuestion });

  return {
    answer,
    sources: [{ title: page.title, path: page.path, heading: chunks.map((chunk) => chunk.metadata.heading).join(", "), campaign: "World", score: 1 }],
  };
}

async function narrateExactWorldAnswer(question: string, context: string, intent: { routeQuestion: boolean; leadershipQuestion: boolean }): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content: [
          "Answer the question about the D&D world using ONLY the supplied world-lore excerpt.",
          "Do not add facts, names, motives, history, geography, or atmosphere that are not explicitly present in the excerpt.",
          "Speak in the voice of a skilled Dungeon Master narrator: clear, vivid, grounded, and table-ready.",
          "Write in flowing prose. Do not use bullet points, numbered lists, markdown headers, markdown tables, source labels, or file paths.",
          "For a broad 'what is' or 'tell me about' question, do not collapse a rich excerpt into one sentence. Give two to four compact paragraphs, preserving the place's identity, setting, history, traditions, economy, law, and notable features when the excerpt provides them.",
          intent.routeQuestion ? "This is a route or travel question. Name the connected places and route types in natural language, then briefly situate the place if the excerpt supports it." : "",
          intent.leadershipQuestion ? "This is a leadership or government question. Lead with who governs or enforces order if the excerpt says so, and say plainly if that detail is not provided." : "",
          "If the excerpt does not contain the requested detail, say that the world notes do not yet name it.",
        ].filter(Boolean).join(" "),
      },
      { role: "user", content: [`Question: ${question}`, "", `World-lore excerpt:\n${context}`, "", "Return only the answer."].join("\n") },
    ],
    { temperature: 0.1 },
  );
}

async function answerRosterQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (!isRosterQuestion(question)) return null;

  const campaign = resolveQuestionCampaign(question, options);
  if (!campaign && shouldAnswerAcrossCampaigns(question, options)) return answerAllCampaignRosters();
  if (!campaign && String(options.campaign ?? "All") === "All") {
    return { answer: "Choose a specific campaign, or ask for the roster across all campaigns. I won't blend campaign rosters unless you explicitly ask for that.", sources: [] };
  }
  if (!campaign) return null;

  const roster = campaignRosters[campaign.code];
  if (!roster) return null;

  const requestedCharacter = extractRosterTargetName(question);
  if (requestedCharacter && !roster.members.some((m) => normalize(m.character) === normalize(requestedCharacter))) {
    const index = await loadIndex();
    const exactPages = Object.values(index.pages ?? {}).filter((page) => normalize(page.title) === normalize(requestedCharacter));
    const otherCampaigns = [...new Set(exactPages.map((p) => p.campaign).filter(Boolean).filter((v) => v !== campaign.indexName))];
    const foundElsewhere = otherCampaigns.length ? ` I found that name in ${formatSeries(otherCampaigns)}, so I am not crossing it into ${campaign.name}.` : "";
    return {
      answer: `${requestedCharacter} is not documented as part of ${campaign.name}'s party.${foundElsewhere} ${campaign.name}'s documented party is ${formatSeries(roster.members.map((m) => m.character))}.`,
      sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
    };
  }

  const target = roster.members.find((m) => normalize(question).includes(normalize(m.character)));
  if (target && /\b(who\s+plays|which\s+player|player\s+of)\b/i.test(question)) {
    return {
      answer: `${target.player} plays ${target.character} in ${campaign.name}.${characterDetailSentence(target)}`,
      sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
    };
  }

  const rows = roster.members.map((m) => `${m.player} plays ${m.character}${characterDetailPhrase(m)}.`).join(" ");
  return {
    answer: `The documented ${campaign.name} party is ${formatSeries(roster.members.map((m) => m.character))}. ${rows}`,
    sources: [{ title: roster.sourceTitle, path: roster.sourcePath, heading: "Active Party Members", campaign: campaign.indexName, score: 1 }],
  };
}

function answerAllCampaignRosters(): QueryResult {
  const parts = Object.values(campaignsByCode)
    .filter((c) => campaignRosters[c.code])
    .map((c) => {
      const roster = campaignRosters[c.code];
      const rows = roster.members.map((m) => `${m.player} plays ${m.character}${characterDetailPhrase(m)}`).join("; ");
      return `${c.name}: ${rows}.`;
    });

  return {
    answer: `Across all campaigns, the player-character mappings are: ${parts.join(" ")}`,
    sources: Object.values(campaignRosters).map((roster) => ({
      title: roster.sourceTitle,
      path: roster.sourcePath,
      heading: "Active Party Members",
      campaign: roster.campaign,
      score: 1,
    })),
  };
}

async function answerLatestSessionQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  if (!/\b(latest|most[\s-]recent|last|newest|current)\b.{0,20}\bsession\b|\bsession\b.{0,20}\b(latest|most[\s-]recent|last|newest|current)\b|\bwhat session\b|\bhow many sessions\b/i.test(question)) return null;

  const scope = resolveQueryScope(question, options);
  const campaign = scope.retrievalCampaign;
  if (!campaign || campaign === "All" || campaign === "World") return null;

  const index = await loadIndex();
  const sessionPages = Object.values(index.pages ?? {}).filter((page) => {
    if ((options.visibility ?? "players") !== "dm" && page.visibility === "dm") return false;
    return page.campaign === campaign && /^wiki\/sessions\//.test(page.path);
  });

  if (!sessionPages.length) return null;

  function parseSessionNumber(page: PageEntry): number {
    const m = (page.title || page.path).match(/Session\s+(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : 0;
  }

  sessionPages.sort((a, b) => parseSessionNumber(b) - parseSessionNumber(a));
  const latest = sessionPages[0];
  const total = sessionPages.length;
  const latestNum = parseSessionNumber(latest);

  const answer = /\bhow many\b/i.test(question)
    ? `${scope.promptCampaign} has **${total} session${total === 1 ? "" : "s"}** documented. The latest is **${latest.title}**.\n\nSources used: [[${latest.title}|${latest.title}]].`
    : `The latest session in ${scope.promptCampaign} is **${latest.title}** (session ${latestNum} of ${total} total).\n\nSources used: [[${latest.title}|${latest.title}]].`;

  return {
    answer,
    sources: [{ title: latest.title, path: latest.path, heading: "", campaign: latest.campaign, score: 1, semanticScore: 0, lexicalScore: 1, directScore: 1 }],
  };
}

async function answerStructuredIndexQuestion(question: string, options: QueryOptions = {}): Promise<QueryResult | null> {
  const scope = resolveQueryScope(question, options);
  const lookup = structuredIndexLookup(question);
  if (!lookup) return null;

  const pagePath = path.join(brainConfig.vaultRoot, ...lookup.path.split("/"));
  let raw = "";
  try {
    raw = await fs.readFile(pagePath, "utf8");
  } catch {
    return null;
  }

  const body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  const lines = selectStructuredLines(body, scope, question, lookup);
  if (!lines.length) return null;

  const campaignLabel = scope.retrievalCampaign === "All" ? "the campaign brain" : scope.promptCampaign;
  const answerLines = [
    `${lookup.title} for ${campaignLabel}:`,
    "",
    ...lines.slice(0, lookup.limit).map((line) => `- ${line}`),
    "",
    `Sources used: [[${lookup.sourceTitle}|${lookup.sourceTitle}]].`,
  ];

  return {
    answer: answerLines.join("\n"),
    sources: [{ title: lookup.sourceTitle, path: lookup.path, heading: lookup.heading, campaign: scope.retrievalCampaign === "World" ? "World" : "All", score: 1, semanticScore: 0, lexicalScore: 1, directScore: 1 }],
  };
}

function structuredIndexLookup(question: string): StructuredLookup | null {
  if (/\b(open|active|unresolved|current)\b/i.test(question) && /\b(thread|threads|quest|quests|lead|leads|plot|plots)\b/i.test(question)) {
    return { title: "Open threads", sourceTitle: "Open Threads By Campaign", path: "wiki/threads/Open Threads By Campaign.md", heading: "Open Threads", limit: 12 };
  }
  if (/\b(faction|factions|group|groups|guild|guilds|organization|organizations)\b/i.test(question)) {
    return { title: "Faction index", sourceTitle: "Factions And Groups Index", path: "wiki/indexes/Factions And Groups Index.md", heading: "Factions", limit: 16 };
  }
  if (/\b(location|locations|place|places|city|cities|town|towns|where)\b/i.test(question) && /\b(list|index|all|known|major|important|active|current)\b/i.test(question)) {
    return { title: "Location index", sourceTitle: "Locations Index", path: "wiki/indexes/Locations Index.md", heading: "Locations", limit: 16 };
  }
  const namedEntities = extractEntityNames(question);
  if (!namedEntities.length && /\b(route|routes|road|roads|connect|connections|travel|path|paths)\b/i.test(question) && /\b(list|index|all|known|major|overview)\b/i.test(question)) {
    return { title: "Route connections", sourceTitle: "World Map Location Index", path: "wiki/world/World Map Location Index.md", heading: "Route Connections", limit: 16 };
  }
  if (/\b(god|gods|deity|deities|pantheon|divine)\b/i.test(question)) {
    return { title: "Pantheon index", sourceTitle: "Pantheon of Myrdae", path: "wiki/concepts/Pantheon of Myrdae.md", heading: "Pantheon", limit: 16 };
  }
  return null;
}

function selectStructuredLines(markdown: string, scope: QueryScope, question: string, lookup: StructuredLookup): string[] {
  const campaign = scope.retrievalCampaign;
  const normalizedCampaign = normalize(campaign);
  const entityNames = extractEntityNames(question).map(normalize);
  const routeQuestion = /\b(route|routes|road|roads|connect|connections|travel|path|paths)\b/i.test(question);
  const lines: string[] = [];
  let currentHeading = "";
  let currentCampaignSection = "All";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      currentHeading = heading[2].trim();
      const headingCampaign = resolveCampaignSelection(currentHeading);
      if (headingCampaign) currentCampaignSection = headingCampaign.indexName;
      if (/world/i.test(currentHeading)) currentCampaignSection = "World";
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!bullet) continue;
    if (isAnswerMaintenanceHeading(currentHeading)) continue;
    if (campaign !== "All" && currentCampaignSection !== "All" && currentCampaignSection !== campaign && currentCampaignSection !== "World") continue;

    const text = bullet[1].replace(/\s+/g, " ").trim();
    if (!text || /^raw source:/i.test(text)) continue;
    const normalizedText = normalize(`${currentHeading} ${text}`);
    if (entityNames.length && !entityNames.some((name) => normalizedText.includes(name))) {
      if (routeQuestion || lookup.path.includes("World Map Location Index")) continue;
    }
    if (campaign !== "All" && currentCampaignSection === "All" && normalizedCampaign && !normalizedText.includes(normalizedCampaign) && !lookup.path.includes("Pantheon")) {
      const mentionsAnyCampaign = Object.values(campaignsByCode).some((c) => normalizedText.includes(normalize(c.indexName)) || normalizedText.includes(normalize(c.name)));
      if (mentionsAnyCampaign) continue;
    }
    lines.push(text);
  }

  return [...new Set(lines)];
}

// ─── Match Curation / Expansion ───────────────────────────────────────────────

function curateMatchesForAnswer(
  matches: IndexItem[],
  question: string,
  intent: { relationshipQuestion: boolean; identityQuestion: boolean; threadQuestion: boolean; storyRecapQuestion: boolean },
): IndexItem[] {
  const recapLike = intent.threadQuestion || intent.storyRecapQuestion;
  const maxMatches = intent.relationshipQuestion ? 12 : intent.identityQuestion ? 18 : recapLike ? 20 : isNarrowQuestion(question) ? 10 : 16;
  const perPageLimit = intent.relationshipQuestion ? 3 : intent.identityQuestion ? 5 : recapLike ? 5 : 3;
  const selected: IndexItem[] = [];
  const seenIds = new Set<string>();
  const pageCounts = new Map<string, number>();

  for (const match of matches) {
    if (seenIds.has(match.id)) continue;
    if (isAnswerMaintenanceHeading(match.metadata.heading)) continue;
    const count = pageCounts.get(match.metadata.path) ?? 0;
    if (count >= perPageLimit) continue;
    selected.push(match);
    seenIds.add(match.id);
    pageCounts.set(match.metadata.path, count + 1);
    if (selected.length >= maxMatches) break;
  }
  return selected;
}

function rerankMatches(question: string, matches: IndexItem[]): IndexItem[] {
  return matches
    .map((match) => {
      const directScore = directAnswerScore(question, match);
      return { ...match, directScore, score: (match.score ?? 0) * 0.84 + directScore * 0.16 };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function directAnswerScore(question: string, match: IndexItem): number {
  const tokens = importantQuestionTokens(question);
  if (!tokens.length) return 0;

  const title = normalize(`${match.metadata.title} ${match.metadata.path}`);
  const heading = normalize(match.metadata.heading);
  const text = normalize(match.text);
  const titleHits = tokens.filter((t) => title.includes(t)).length;
  const headingHits = tokens.filter((t) => heading.includes(t)).length;
  const textHits = tokens.filter((t) => text.includes(t)).length;
  const coverage = textHits / tokens.length;

  let score = coverage * 0.48;
  score += Math.min(titleHits / tokens.length, 1) * 0.28;
  score += Math.min(headingHits / tokens.length, 1) * 0.12;
  if (isNarrowQuestion(question) && titleHits > 0) score += 0.12;
  if (/\b(route|road|connect|travel|path|way)\b/i.test(question) && /\b(route|connection|road|travel)\b/i.test(match.metadata.heading)) score += 0.14;
  if (/\b(thread|quest|lead|unresolved|open)\b/i.test(question) && /\b(thread|quest|lead|open|status)\b/i.test(match.metadata.heading)) score += 0.14;
  return Math.min(score, 1);
}

function importantQuestionTokens(question: string): string[] {
  const stopwords = new Set(["a", "an", "and", "are", "about", "does", "for", "from", "in", "is", "it", "of", "the", "to", "was", "what", "who", "where", "when", "why", "how", "with", "all", "tell", "me", "know", "do", "you", "this", "that"]);
  return normalize(question).split(" ").filter((token) => token.length > 2 && !stopwords.has(token));
}

function expandCoMentionMatches(
  index: BrainIndex,
  matches: IndexItem[],
  question: string,
  options: { campaign: string; visibility: string },
): IndexItem[] {
  const entityNames = [...new Set(extractEntityNames(question).map(normalize))];
  if (entityNames.length < 2) return matches;

  const expanded = [...matches];
  const matchesById = new Map(expanded.map((m) => [m.id, m]));
  const coMentions = index.items
    .filter((item) => isAllowed(item, options))
    .filter((item) => {
      const pageKey = normalize(`${item.metadata.title} ${item.metadata.path}`);
      if (!entityNames.some((name) => pageKey.includes(name))) return false;
      const haystack = normalize(`${item.metadata.title} ${item.metadata.heading} ${item.text}`);
      return entityNames.every((name) => haystack.includes(name));
    })
    .map((item) => ({ ...item, score: coMentionScore(item) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const candidate of coMentions) {
    addOrBoostMatch(expanded, matchesById, candidate);
    if (expanded.length >= Math.max(brainConfig.topK + 22, matches.length + 8)) break;
  }

  return expanded;
}

function expandEntityMatches(
  index: BrainIndex,
  semanticMatches: IndexItem[],
  question: string,
  options: { campaign: string; visibility: string },
): IndexItem[] {
  const entityNames = extractEntityNames(question);
  if (!entityNames.length) return semanticMatches;

  const expanded = [...semanticMatches];
  const matchesById = new Map(expanded.map((m) => [m.id, m]));
  const minimumExpandedResults = Math.max(brainConfig.topK + 17, semanticMatches.length + 17);

  for (const entityName of entityNames) {
    const candidatesByPage = new Map<string, IndexItem[]>();
    const candidates = index.items
      .filter((item) => isAllowed(item, options))
      .filter((item) => isEntityRelated(item, entityName))
      .map((item) => ({ ...item, score: entityExpansionScore(item, entityName) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    for (const candidate of candidates) {
      const pg = candidate.metadata.path;
      if (!candidatesByPage.has(pg)) candidatesByPage.set(pg, []);
      candidatesByPage.get(pg)!.push(candidate);
    }

    const pages = [...candidatesByPage.entries()].sort(([pathA], [pathB]) => pagePriority(pathA, entityName) - pagePriority(pathB, entityName));
    for (const [, pageCandidates] of pages) {
      let addedFromPage = 0;
      for (const candidate of pageCandidates) {
        const added = addOrBoostMatch(expanded, matchesById, candidate);
        if (!added) continue;
        addedFromPage++;
        if (addedFromPage >= 4) break;
      }
    }

    for (const candidate of candidates) {
      addOrBoostMatch(expanded, matchesById, candidate);
      if (expanded.length >= minimumExpandedResults) break;
    }
  }

  return expanded.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, Math.max(minimumExpandedResults, semanticMatches.length));
}

function expandGraphMatches(
  index: BrainIndex,
  matches: IndexItem[],
  question: string,
  options: { campaign: string; visibility: string },
): IndexItem[] {
  if (!index.pages) return matches;

  const expanded = [...matches];
  const matchesById = new Map(expanded.map((m) => [m.id, m]));
  const anchorPages = selectAnchorPages(index, matches, question, options);
  const relatedPages = new Set<string>();

  for (const pagePath of anchorPages) {
    const page = index.pages[pagePath];
    if (!page) continue;
    for (const linkedPath of page.links ?? []) {
      if (index.pages[linkedPath]) relatedPages.add(linkedPath);
    }
    for (const backlinkPath of page.backlinks ?? []) {
      if (index.pages[backlinkPath]) relatedPages.add(backlinkPath);
    }
  }

  const graphCandidates = index.items
    .filter((item) => relatedPages.has(item.metadata.path))
    .filter((item) => isAllowed(item, options))
    .map((item) => ({ ...item, score: graphExpansionScore(item, anchorPages) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const perPageCount = new Map<string, number>();
  for (const candidate of graphCandidates) {
    const count = perPageCount.get(candidate.metadata.path) ?? 0;
    if (count >= 2) continue;
    const added = addOrBoostMatch(expanded, matchesById, candidate);
    if (!added) continue;
    perPageCount.set(candidate.metadata.path, count + 1);
    if (expanded.length >= Math.max(brainConfig.topK + 24, matches.length + 8)) break;
  }

  return expanded.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, Math.max(brainConfig.topK + 24, matches.length));
}

function addOrBoostMatch(matches: IndexItem[], matchesById: Map<string, IndexItem>, candidate: IndexItem): boolean {
  const existing = matchesById.get(candidate.id);
  if (existing) {
    if ((candidate.score ?? 0) > (existing.score ?? 0)) {
      existing.score = candidate.score;
      existing.semanticScore = candidate.semanticScore ?? existing.semanticScore;
      existing.lexicalScore = candidate.lexicalScore ?? existing.lexicalScore;
    }
    return false;
  }
  matches.push(candidate);
  matchesById.set(candidate.id, candidate);
  return true;
}

function selectAnchorPages(
  index: BrainIndex,
  matches: IndexItem[],
  question: string,
  options: { campaign: string; visibility: string },
): Set<string> {
  const anchors = new Set<string>();
  const entityNames = extractEntityNames(question);

  for (const entityName of entityNames) {
    const exactPage = Object.values(index.pages)
      .filter((page) => pageAllowed(page, options))
      .find((page) => normalize(page.title) === normalize(entityName));
    if (exactPage) anchors.add(exactPage.path);
  }

  for (const match of matches.slice(0, 8)) {
    if (pageAllowed(index.pages[match.metadata.path], options)) {
      anchors.add(match.metadata.path);
    }
  }

  return anchors;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function entityExpansionScore(item: IndexItem, entityName: string): number {
  const normalizedName = normalize(entityName);
  const title = normalize(item.metadata.title);
  const heading = normalize(item.metadata.heading);

  let score = 0.75;
  if (title === normalizedName) score += 0.15;
  if (title.startsWith(`${normalizedName} `)) score += 0.1;

  const headingPriority = ["summary", "character reference", "current read", "core identity", "role in party", "current role in the party", "goals", "personal quests", "interests", "religion and values", "motivations", "enemies threats and suspicions", "strong inferences", "directly documented sequence"];
  const priorityIndex = headingPriority.indexOf(heading);
  if (priorityIndex >= 0) score += (headingPriority.length - priorityIndex) / 100;
  return score;
}

function graphExpansionScore(item: IndexItem, anchorPages: Set<string>): number {
  const heading = normalize(item.metadata.heading);
  let score = 0.72;
  if (anchorPages.has(item.metadata.path)) score += 0.08;

  const headingPriority = ["summary", "current read", "thread status", "strong inferences", "directly documented sequence", "current leads", "open questions", "known gaps to watch", "relationships and suspicions"];
  const priorityIndex = headingPriority.indexOf(heading);
  if (priorityIndex >= 0) score += (headingPriority.length - priorityIndex) / 100;
  return score;
}

function coMentionScore(item: IndexItem): number {
  const heading = normalize(item.metadata.heading);
  let score = 1.08;
  if (["relationships and suspicions", "friends and allies", "friends and trusted bonds", "suspicions and leads", "enemies threats and suspicions", "goals and active leads", "confirmed personal thread", "open gaps", "current leads", "known bonds", "tensions"].includes(heading)) {
    score += 0.08;
  }
  if (/\b(theft|lies|vision|suspect|challenge|accountable|detect thoughts|hidden truths)\b/i.test(item.text)) score += 0.08;
  return score;
}

function pagePriority(pagePath: string, entityName: string): number {
  const normalizedPath = normalize(pagePath);
  const normalizedName = normalize(entityName);
  if (normalizedPath.includes(`entities ${normalizedName} md`)) return 0;
  if (normalizedPath.includes(`${normalizedName} personal history and goals`)) return 1;
  if (normalizedPath.includes(`${normalizedName} reyvennra memory thread`)) return 2;
  if (normalizedPath.includes(`${normalizedName}`)) return 3;
  return 4;
}

// ─── Question Classification ───────────────────────────────────────────────────

function isRosterQuestion(question: string): boolean {
  return /\b(who\s+plays|who\s+is\s+playing|which\s+player|player\s+character|player-character|players?\s+and\s+characters?|party\s+roster|active\s+party|list\s+(?:all\s+)?(?:the\s+)?(?:characters?|players?|people)|all\s+(?:the\s+)?(?:characters?|players?|people)|who(?:\s+(?:is|are)|'s)\s+(?:all\s+)?(?:in|playing\s+in)\b|who\s+is\s+in\s+the\s+party|who\s+are\s+(?:all\s+)?(?:the\s+)?(?:characters?|players?|people))\b/i.test(question);
}

function isRelationshipQuestion(question: string): boolean {
  return hasRelationshipKeyword(question) && extractEntityNames(question).length >= 2;
}

function isIdentityQuestion(question: string): boolean {
  const value = String(question ?? "");
  if (/\bwhat\s+are\b/i.test(value) && /\band\b/i.test(value)) return false;
  return extractEntityNames(value).length > 0;
}

function hasRelationshipKeyword(question: string): boolean {
  return /\b(know about|knows about|relationship|relationships|connection|connected|think of|thinks of|suspect|suspects|trust|trusts|feel about|feels about)\b/i.test(question);
}

function isThreadQuestion(question: string): boolean {
  return /\b(thread|plot|quest|lead|mystery|storyline|story line|arc)\b/i.test(question);
}

function isStoryRecapQuestion(question: string): boolean {
  const value = String(question ?? "");
  return /\b(summarize|summary|recap|what happened|session recap|tell me what happened|catch me up|previously on)\b/i.test(value) || (/\b(session|episode|last night|last session)\b/i.test(value) && /\b(what|summarize|recap|tell|happened)\b/i.test(value));
}

function isNarrowQuestion(question: string): boolean {
  return /\b(stand for|mean|when|where|which|how many|what is the name|what was the name|who is the|who was the|who plays|player of|class|species)\b/i.test(question);
}

function isWorldOnlyQuestion(question: string): boolean {
  if (isSuperlativeWorldQuestion(question)) return false;
  return /\b(Oberra|Myrdae|Pantheon of Myrdae|Territories of Myrdae|History of Myrdae|Regions of Myrdae|Calendar of Myrdae|Species of Myrdae|Languages of Myrdae|Factions of Myrdae|Myths and Tales of Myrdae|Myrdae Stories and Tales|Abbey of Light|Abbey of Mont Rest|O'?naren Gazetteer|O'?naren|Qal'dynn|Driftglow Pond|Emberstran Gazetteer|Emberstran|Winbalt|Ahndashere Gazetteer|Ahndashere|Basctdelm Gazetteer|Basctdelm|Lake Tribathe|Halesworth|Bathaen Empire|Queen Breya|Breya Talward|Scarwatch Hold Gazetteer|Nunglthil Gazetteer|Nunglthil|Rothenloch|Pact Council|Crown of Lyess|Affirmation of Strife|Laztyr|Dunduar|Oldport|Bistron|Ulgreer|Lunar Facets|Harmon Order|Endelo'?ar|Tudara|Broken One)\b/i.test(question) && !/\b(in|for|from|during)\s+(HoE|SoD|Dungeons III|Dungeons 3|D3|The Silent Vanguard|Silent Vanguard|Bloody Endeavor|Wyrm Bane)\b/i.test(question);
}

function isCrossCampaignWorldQuestion(question: string): boolean {
  const hasWorldSubject = /\b(Oberra|Myrdae|Emberstran|O'?naren|Ahndashere|Basctdelm|Scarwatch|Nunglthil|Adsuren|Gibuldon|world lore|shared world)\b/i.test(question);
  const asksAboutEvents = /\b(what happened|has happened|happening|going on|events?|history|parties|campaigns|adventures?|visited|encountered|experienced|know about)\b/i.test(question);
  return hasWorldSubject && asksAboutEvents;
}

function isSuperlativeWorldQuestion(question: string): boolean {
  const hasSuperlative = /\b(strongest|most powerful|greatest|best|most feared|most skilled|most dangerous|most renowned|most famous|most notorious|most ancient|oldest|most legendary|mightiest|wisest|richest|most influential|deadliest|most gifted|most accomplished)\b/i.test(question);
  const hasWorldScope = /\b(in all of myrdae|across myrdae|in myrdae|in the world|across the world|in all of oberra|across oberra|in all campaigns|across all campaigns|across all)\b/i.test(question);
  return hasSuperlative && hasWorldScope;
}

function shouldAnswerAcrossCampaigns(question: string, options: QueryOptions = {}): boolean {
  if (options.campaign && options.campaign !== "All") return false;
  return /\b(across\s+all\s+campaigns|all\s+campaigns|every\s+campaign|all\s+the\s+campaigns)\b/i.test(question);
}

// ─── Entity / Campaign Resolution ─────────────────────────────────────────────

function extractEntityNames(question: string): string[] {
  if (!hasRelationshipKeyword(question)) {
    const direct = question.match(/\b(?:who|what)\s+(?:is|are|was|were)\s+([A-Z][A-Za-z' -]{1,60})\??$/i);
    if (direct) return [cleanEntityName(direct[1])].filter(Boolean);
  }
  return [...question.matchAll(/\b[A-Z][A-Za-z']{2,}(?:\s+[A-Z][A-Za-z']{2,}){0,3}\b/g)]
    .map((m) => cleanEntityName(m[0]))
    .filter((name) => !["Who", "What", "Where", "When", "Why", "How"].includes(name))
    .filter((name) => !isCampaignReferenceName(name));
}

function cleanEntityName(value: string): string {
  const cleaned = value
    .replace(/[?.!,;:]+$/g, "")
    .replace(/\b(in|from|for|about)\b.*$/i, "")
    .replace(/\b(thread|plot|quest|lead|mystery|storyline|story line|arc)\b$/i, "")
    .replace(/^the\s+/i, "")
    .trim();
  return canonicalEntityName(cleaned);
}

function canonicalEntityName(entityName: string): string {
  const normalized = normalize(entityName);
  return entityAliases[normalized] ?? entityName;
}

function isCampaignReferenceName(value: string): boolean {
  const normalized = normalize(value);
  return Object.values(campaignsByCode).some(
    (c) => normalized === normalize(c.code) || normalized === normalize(c.name) || c.aliases.some((alias) => normalized === normalize(alias)),
  );
}

function resolveQuestionCampaign(question: string, options: QueryOptions = {}): CampaignDef | null {
  if (options.campaign && options.campaign !== "All") {
    return Object.values(campaignsByCode).find((c) => c.code === options.campaign || c.name === options.campaign) ?? null;
  }
  const normalized = normalize(question);
  return Object.values(campaignsByCode).find((c) => normalized.includes(normalize(c.name)) || normalized.includes(normalize(c.code)) || c.aliases.some((alias) => normalized.includes(normalize(alias)))) ?? null;
}

function resolveCampaignSelection(value: string): CampaignDef | null {
  return Object.values(campaignsByCode).find((c) => c.code === value || c.name === value || c.indexName === value) ?? null;
}

function extractRosterTargetName(question: string): string {
  const match = String(question).match(/\b(?:who\s+plays|who\s+is\s+playing|which\s+player\s+plays)\s+([A-Z][A-Za-z' -]{1,60}?)(?:\s+(?:in|for|from)\s+(?:HoE|SoD|D3|TSV|WB|Dungeons III|Dungeons 3|The Silent Vanguard|Silent Vanguard|Bloody Endeavor|Wyrm Bane|Heroes of Emberstran|Souls of Destiny))?\??$/i);
  if (!match) return "";
  return cleanEntityName(match[1]);
}

function findEntityPages(index: BrainIndex, entityName: string): PageEntry[] {
  const target = normalize(canonicalEntityName(entityName));
  return Object.values(index.pages ?? {}).filter((page) => {
    const title = normalize(page.title);
    return title === target || title.startsWith(`${target} `) || target.startsWith(`${title} `);
  });
}

function findRosterMember(roster: CampaignRoster, entityName: string): RosterMember | null {
  const target = normalize(canonicalEntityName(entityName));
  return roster.members.find((m) => {
    const character = normalize(m.character);
    return character === target || character.startsWith(`${target} `) || target.startsWith(`${character} `);
  }) ?? null;
}

function isRosterCharacterInCampaign(entityName: string, scope: QueryScope): boolean {
  const resolved = resolveCampaignSelection(scope.retrievalCampaign ?? scope.promptCampaign ?? "");
  const roster = campaignRosters[resolved?.code ?? ""];
  if (!roster) return false;
  return Boolean(findRosterMember(roster, entityName));
}

// ─── Relationship / Tone Helpers ───────────────────────────────────────────────

function isRelationshipEvidenceHeading(heading: string): boolean {
  return ["relationships and suspicions", "friends and allies", "friends and trusted bonds", "tensions", "pre campaign relationship intent", "pre-campaign relationship intent"].includes(normalize(heading));
}

function extractRelationshipFactLines(text: string, firstName: string, secondName: string, pageOtherName: string | null): string[] {
  const names = [firstName, secondName].map(normalize);
  const other = pageOtherName ? normalize(pageOtherName) : null;
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^#{1,6}\s+/.test(line));
  return lines.filter((line) => {
    const normalizedLine = normalize(line);
    if (other && normalizedLine.includes(other)) return true;
    return names.every((name) => normalizedLine.includes(name));
  });
}

function cleanFactLine(line: string): string {
  return String(line).replace(/^[-*]\s+/, "").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/\s+/g, " ").trim();
}

function sentenceFromFact(fact: string): string {
  const trimmed = String(fact).trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function relationshipToneFromFacts(facts: string[], firstName: string, secondName: string): RelationshipTone {
  const text = normalize(facts.join(" "));
  const pair = [normalize(firstName), normalize(secondName)];
  const pairIncludesThreatFigure = pair.some((name) => ["aeolenne", "eyovar dunajor", "summoner karranok", "ganon", "sir rodolf norran"].includes(name));
  const hostile = pairIncludesThreatFigure && /\b(enemy|hostile|threat|manipulat|possess|control|danger|fear|fiend|succubus|mother|parent|rage|vulnerability)\b/.test(text);

  if (hostile) {
    return {
      intro: (first, second) => `The vault documents ${first} and ${second} as a dangerous or unresolved relationship, not a friendly party bond.`,
      close: (first, second) => `So the safest read is that ${first} and ${second} are tied by threat, identity, and unresolved consequences; anything warmer or more trusting than that is not clearly documented.`,
    };
  }

  return {
    intro: (first, second) => `The vault documents ${first} and ${second} mostly through direct party-bond notes, not as a fully explored private relationship.`,
    close: (first, second) => `So the safest read is that ${first} and ${second} have a documented practical bond in the party, with the limits and tensions above; anything deeper than that has not been written clearly yet.`,
  };
}

// ─── Route / World Narration ───────────────────────────────────────────────────

function narrateRouteConnections(placeName: string, context: string): string {
  const routes = extractRouteConnections(context);
  if (!routes.length) return `The world notes do not yet name the routes that connect to ${placeName}.`;

  const byType = routes.reduce((groups, route) => {
    const label = route.routeType === "water-route" ? "water routes" : route.routeType === "major" ? "major roads" : route.routeType === "minor" ? "minor roads" : `${route.routeType} routes`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(route.connectedLocation);
    return groups;
  }, new Map<string, string[]>());

  const routeSentences = [...byType.entries()].map(([label, locations]) => `${capitalize(label)} run between ${placeName} and ${formatSeries(locations)}.`);
  const overview = extractFirstNonTableParagraph(context);
  return [`${placeName} is tied into Myrdae's travel web through ${formatSeries(routes.map((r) => r.connectedLocation))}.`, routeSentences.join(" "), overview].filter(Boolean).join(" ");
}

function extractRouteConnections(context: string): { connectedLocation: string; routeType: string; routeId: string }[] {
  return String(context)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ connectedLocation: m[1].trim(), routeType: m[2].trim(), routeId: m[3].trim() }))
    .filter((r) => !/^connected location$/i.test(r.connectedLocation))
    .filter((r) => !/^[-:]+$/.test(r.connectedLocation))
    .filter((r) => r.connectedLocation && r.routeType && r.routeId);
}

function extractFirstNonTableParagraph(context: string): string {
  const paragraphs = String(context).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).filter((p) => !p.split(/\r?\n/).every((line) => /^\|/.test(line.trim())));
  return paragraphs[0] ?? "";
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function isAllowed(item: IndexItem, options: { campaign: string; visibility: string }): boolean {
  const campaign = options.campaign ?? "All";
  const visibility = options.visibility ?? "players";
  if (visibility !== "dm" && item.metadata.visibility === "dm") return false;
  return campaign === "All" || item.metadata.campaign === campaign || item.metadata.campaign === "World" || isSharedWorldPath(item.metadata.path);
}

function pageAllowed(page: PageEntry | undefined, options: { campaign: string; visibility: string }): boolean {
  if (!page) return false;
  const campaign = options.campaign ?? "All";
  const visibility = options.visibility ?? "players";
  if (visibility !== "dm" && page.visibility === "dm") return false;
  return campaign === "All" || page.campaign === campaign || page.campaign === "World" || isSharedWorldPath(page.path);
}

function isSharedWorldPath(sourcePath: string): boolean {
  const normalized = String(sourcePath ?? "").replaceAll(path.sep, "/");
  return normalized.startsWith("wiki/world/") || normalized === "wiki/concepts/Pantheon of Myrdae.md";
}

function isEntityRelated(item: IndexItem, entityName: string): boolean {
  const normalizedName = normalize(entityName);
  const title = normalize(item.metadata.title);
  const pathParts = normalize(item.metadata.path).split(" ");
  return title === normalizedName || title.startsWith(`${normalizedName} `) || pathParts.includes(normalizedName);
}

// ─── Character / Roster Helpers ───────────────────────────────────────────────

function articleFor(value: string): string {
  return /^[aeiou]/i.test(String(value).trim()) ? "an" : "a";
}

function characterDetailSentence(member: RosterMember): string {
  const speciesKnown = member.species && member.species !== "Unknown";
  const classKnown = member.className && member.className !== "Unknown";
  if (speciesKnown && classKnown) return ` ${member.character} is ${articleFor(member.species)} ${member.species} ${member.className}.`;
  if (speciesKnown) return ` ${member.character} is ${articleFor(member.species)} ${member.species}.`;
  if (classKnown) return ` ${member.character} is recorded as ${member.className}.`;
  return "";
}

function characterDetailPhrase(member: RosterMember): string {
  const speciesKnown = member.species && member.species !== "Unknown";
  const classKnown = member.className && member.className !== "Unknown";
  if (speciesKnown && classKnown) return `, ${articleFor(member.species)} ${member.species} ${member.className}`;
  if (classKnown) return `, ${member.className}`;
  if (speciesKnown) return `, ${articleFor(member.species)} ${member.species}`;
  return "";
}

// ─── Text / Markdown Helpers ──────────────────────────────────────────────────

function stripMarkdownHeadings(value: string): string {
  return String(value)
    .split(/\r?\n/)
    .filter((line) => !/^#{1,6}\s+/.test(line.trim()))
    .filter((line) => !/^<!--[\s\S]*-->$/.test(line.trim()))
    .join("\n")
    .trim();
}

function isAnswerMaintenanceHeading(heading: string): boolean {
  return ["scope", "campaign scope", "source type", "source anchors", "related pages"].includes(normalize(heading));
}

function formatSeries(values: string[]): string {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique.at(-1)}`;
}

function capitalize(value: string): string {
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalize(value: string): string {
  return String(value).toLowerCase().replaceAll("'", "").replace(/[^a-z0-9]+/g, " ").trim();
}
