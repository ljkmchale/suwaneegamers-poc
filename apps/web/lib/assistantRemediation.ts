import fs from "node:fs";
import { createHash } from "node:crypto";
import { contentPath } from "@/lib/contentFiles";
import {
  normalizeQuestion,
  readLearned,
  trimForVoice,
  writeLearned,
  type LearnedAnswer,
} from "@/lib/assistantLearned";

export type RemediationCategory =
  | "brain-source-improvement"
  | "routing-correction"
  | "pronunciation-fix"
  | "learned-answer";

export type RemediationStatus = "pending" | "approved" | "dismissed";
export type RemediationApplicationKind =
  | "mishearing"
  | "pronunciation"
  | "learned-answer"
  | "brain-task"
  | "routing-task";

export interface RemediationApplication {
  kind: RemediationApplicationKind;
  key: string;
  value: string;
  target: string;
  appliedAt: string;
  verifiedAt?: string;
}

export interface RemediationTestResult {
  originalQuestion: string;
  correctedQuestion: string;
  answer: string;
  evidence: string[];
  testedAt: string;
}

export interface RemediationEntry {
  id: string;
  question: string;
  normalized: string;
  category: RemediationCategory;
  proposedCorrection: string;
  answerCandidate?: string;
  evidence: string[];
  source: "showcase" | "nightly-learning" | "voice-analytics";
  timesSeen: number;
  status: RemediationStatus;
  createdAt: string;
  reviewedAt?: string;
  application?: RemediationApplication;
  testResult?: RemediationTestResult;
}

export interface RemediationStore {
  entries: RemediationEntry[];
  updatedAt: string;
}

const FILE = "assistant-remediation.json";
const AUDIT_FILE = "assistant-remediation-audit.json";
const TASKS_FILE = "assistant-remediation-tasks.json";
const MISHEARINGS_FILE = "assistant-mishearings.json";
const PRONUNCIATIONS_FILE = "assistant-pronunciations.json";
const EMPTY: RemediationStore = { entries: [], updatedAt: "" };

export interface RemediationAuditEntry {
  id: string;
  remediationId: string;
  action: "applied" | "undone";
  application: RemediationApplication;
  previousValue?: string;
  createdAt: string;
  undoneAt?: string;
}

export interface RemediationTask {
  id: string;
  remediationId: string;
  kind: "brain-task" | "routing-task";
  question: string;
  proposedCorrection: string;
  evidence: string[];
  status: "open" | "undone";
  createdAt: string;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(contentPath(file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  const target = contentPath(file);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

export function readRemediations(): RemediationStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(contentPath(FILE), "utf8")) as Partial<RemediationStore>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return EMPTY;
  }
}

export function writeRemediations(store: RemediationStore): void {
  writeJson(FILE, store);
}

export function readRemediationAudit(): RemediationAuditEntry[] {
  return readJson<{ entries?: RemediationAuditEntry[] }>(AUDIT_FILE, { entries: [] }).entries ?? [];
}

export function remediationId(question: string, category: RemediationCategory): string {
  const digest = createHash("sha256")
    .update(`${normalizeQuestion(question)}|${category}`)
    .digest("hex")
    .slice(0, 16);
  return `rem-${digest}`;
}

export function enqueueRemediation(
  input: Omit<RemediationEntry, "id" | "normalized" | "status" | "createdAt">,
): RemediationEntry {
  const store = readRemediations();
  const normalized = normalizeQuestion(input.question);
  const id = remediationId(input.question, input.category);
  const existing = store.entries.find((entry) => entry.id === id && entry.status === "pending");
  const now = new Date().toISOString();
  if (existing) {
    existing.timesSeen = Math.max(existing.timesSeen, input.timesSeen);
    existing.proposedCorrection = input.proposedCorrection;
    existing.answerCandidate = input.answerCandidate;
    existing.evidence = [...new Set(input.evidence.filter(Boolean))].slice(0, 8);
    store.updatedAt = now;
    writeRemediations(store);
    return existing;
  }
  const entry: RemediationEntry = {
    ...input,
    id,
    normalized,
    status: "pending",
    createdAt: now,
    evidence: [...new Set(input.evidence.filter(Boolean))].slice(0, 8),
  };
  store.entries.unshift(entry);
  store.updatedAt = now;
  writeRemediations(store);
  return entry;
}

export function proposeRemediationApplication(entry: RemediationEntry): {
  kind: RemediationApplicationKind;
  key: string;
  value: string;
  target: string;
} {
  if (entry.category === "learned-answer") {
    return {
      kind: "learned-answer",
      key: entry.question,
      value: entry.answerCandidate ?? "",
      target: "Myra learned answers",
    };
  }
  if (entry.category === "brain-source-improvement") {
    return {
      kind: "brain-task",
      key: entry.question,
      value: entry.proposedCorrection,
      target: "Brain source task queue",
    };
  }
  if (entry.category === "routing-correction") {
    return {
      kind: "routing-task",
      key: entry.question,
      value: entry.proposedCorrection,
      target: "Routing task queue",
    };
  }

  const explicit = entry.question.match(/\b(?:not|isn't)\s+(.+?),?\s+(?:it(?:'s| is)|but)\s+(.+?)[.!]?$/i);
  if (explicit) {
    return {
      kind: "mishearing",
      key: explicit[1].trim(),
      value: explicit[2].trim().replace(/[.!]+$/, ""),
      target: MISHEARINGS_FILE,
    };
  }
  const knownAliases: Array<[RegExp, string, string]> = [
    [/\bhey mara\b/i, "Mara", "Myra"],
    [/\bdevira\b/i, "Devira", "Diverra"],
    [/\bdiveria\b/i, "Diveria", "Diverra"],
  ];
  const alias = knownAliases.find(([pattern]) => pattern.test(entry.question));
  return {
    kind: "mishearing",
    key: alias?.[1] ?? "",
    value: alias?.[2] ?? "",
    target: MISHEARINGS_FILE,
  };
}

function applyObjectMap(file: string, key: string, value: string): string | undefined {
  const map = readJson<Record<string, string>>(file, {});
  const previous = map[key];
  map[key] = value;
  writeJson(file, map);
  return previous;
}

function appendAudit(entry: RemediationAuditEntry): void {
  const entries = readRemediationAudit();
  writeJson(AUDIT_FILE, { entries: [entry, ...entries].slice(0, 500) });
}

export function approveRemediation(
  id: string,
  requested?: Partial<Pick<RemediationApplication, "kind" | "key" | "value">>,
): void {
  const store = readRemediations();
  const entry = store.entries.find((candidate) => candidate.id === id);
  if (!entry || entry.status !== "pending") return;

  const proposal = proposeRemediationApplication(entry);
  const allowedKinds: RemediationApplicationKind[] = [
    "mishearing",
    "pronunciation",
    "learned-answer",
    "brain-task",
    "routing-task",
  ];
  const kind = requested?.kind && allowedKinds.includes(requested.kind)
    ? requested.kind
    : proposal.kind;
  const key = String(requested?.key || proposal.key).trim();
  const value = String(requested?.value || proposal.value).trim();
  if (!key || !value) throw new Error("A correction key and value are required before approval.");

  const now = new Date().toISOString();
  let previousValue: string | undefined;
  let target = proposal.target;

  if (kind === "mishearing" || kind === "pronunciation") {
    const file = kind === "mishearing" ? MISHEARINGS_FILE : PRONUNCIATIONS_FILE;
    target = file;
    previousValue = applyObjectMap(file, key, value);
  } else if (kind === "learned-answer") {
    if (entry.evidence.length === 0) throw new Error("A learned answer requires grounded evidence.");
    const learned = readLearned();
    const previous = learned.answers.find((answer) => answer.normalized === entry.normalized);
    previousValue = previous ? JSON.stringify(previous) : undefined;
    const learnedAnswer: LearnedAnswer = {
      question: entry.question,
      normalized: entry.normalized,
      answer: trimForVoice(value),
      sources: entry.evidence.slice(0, 5),
      timesAsked: Math.max(1, entry.timesSeen),
      learnedAt: now,
    };
    const answers = learned.answers.filter((answer) => answer.normalized !== entry.normalized);
    writeLearned({
      ...learned,
      answers: [learnedAnswer, ...answers],
      gaps: learned.gaps.filter((gap) => gap.normalized !== entry.normalized),
      updatedAt: learnedAnswer.learnedAt,
    });
    target = "assistant-learned.json";
  } else {
    const tasks = readJson<{ entries: RemediationTask[] }>(TASKS_FILE, { entries: [] });
    const task: RemediationTask = {
      id: `task-${id}`,
      remediationId: id,
      kind,
      question: key,
      proposedCorrection: value,
      evidence: entry.evidence,
      status: "open",
      createdAt: now,
    };
    const previous = tasks.entries.find((candidate) => candidate.id === task.id);
    previousValue = previous ? JSON.stringify(previous) : undefined;
    writeJson(TASKS_FILE, {
      entries: [task, ...tasks.entries.filter((candidate) => candidate.id !== task.id)],
    });
    target = TASKS_FILE;
  }

  entry.status = "approved";
  entry.reviewedAt = now;
  entry.application = { kind, key, value, target, appliedAt: now };
  store.updatedAt = entry.reviewedAt;
  writeRemediations(store);
  appendAudit({
    id: `audit-${id}-${Date.now()}`,
    remediationId: id,
    action: "applied",
    application: entry.application,
    previousValue,
    createdAt: now,
  });
}

export function saveRemediationTest(id: string, result: RemediationTestResult): void {
  const store = readRemediations();
  const entry = store.entries.find((candidate) => candidate.id === id);
  if (!entry) return;
  entry.testResult = result;
  store.updatedAt = result.testedAt;
  writeRemediations(store);
}

export function undoRemediation(auditId: string): void {
  const audits = readRemediationAudit();
  const audit = audits.find((candidate) => candidate.id === auditId);
  if (!audit || audit.action !== "applied" || audit.undoneAt) return;
  const { kind, key } = audit.application;
  if (kind === "mishearing" || kind === "pronunciation") {
    const file = kind === "mishearing" ? MISHEARINGS_FILE : PRONUNCIATIONS_FILE;
    const map = readJson<Record<string, string>>(file, {});
    if (audit.previousValue === undefined) delete map[key];
    else map[key] = audit.previousValue;
    writeJson(file, map);
  } else if (kind === "learned-answer") {
    const learned = readLearned();
    const answers = learned.answers.filter((answer) => answer.normalized !== normalizeQuestion(key));
    if (audit.previousValue) answers.unshift(JSON.parse(audit.previousValue) as LearnedAnswer);
    writeLearned({ ...learned, answers, updatedAt: new Date().toISOString() });
  } else {
    const tasks = readJson<{ entries: RemediationTask[] }>(TASKS_FILE, { entries: [] });
    const taskId = `task-${audit.remediationId}`;
    const entries = tasks.entries.filter((task) => task.id !== taskId);
    if (audit.previousValue) entries.unshift(JSON.parse(audit.previousValue) as RemediationTask);
    writeJson(TASKS_FILE, { entries });
  }
  const now = new Date().toISOString();
  audit.undoneAt = now;
  const undoAudit: RemediationAuditEntry = {
    id: `audit-undo-${audit.id}-${Date.now()}`,
    remediationId: audit.remediationId,
    action: "undone",
    application: audit.application,
    createdAt: now,
  };
  writeJson(AUDIT_FILE, { entries: [undoAudit, ...audits] });
}

export function dismissRemediation(id: string): void {
  const store = readRemediations();
  const entry = store.entries.find((candidate) => candidate.id === id);
  if (!entry || entry.status !== "pending") return;
  entry.status = "dismissed";
  entry.reviewedAt = new Date().toISOString();
  store.updatedAt = entry.reviewedAt;
  writeRemediations(store);
}
