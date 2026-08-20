import fs from "node:fs";
import { contentPath } from "@/lib/contentFiles";
import { normalizeQuestion } from "@/lib/assistantLearned";

// Data-driven routing overrides — the safe alternative to letting Myra rewrite
// her own routing code. Each entry names a question that must BYPASS the
// deterministic keyword shortcuts and be answered by the grounded language model.
//
// The safety property: an override can only ever send a question to the model.
// It can never make Myra say a specific thing or route to a wrong compartment, so
// the worst case is "a question that could have been a fast template now goes
// through the model" — still grounded, still correct. That is what makes it safe
// for the nightly job to add these unattended, from confirmed misroutes.
//
// Read like mishearings (fs, shipped in dispatch metadata). The agent normalizes
// each question with its OWN normalizer and matches the current turn against the
// set — so cross-language normalization differences never matter; only the raw
// question text is shipped.

export interface RoutingOverride {
  question: string;
  normalized: string;
  reason: string;
  addedAt: string;
}

interface RoutingOverrideStore {
  forceModel: RoutingOverride[];
  updatedAt: string;
}

const FILE = "assistant-routing-overrides.json";
const MAX_OVERRIDES = 100;

const EMPTY: RoutingOverrideStore = { forceModel: [], updatedAt: "" };

export function readRoutingOverrides(): RoutingOverrideStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(contentPath(FILE), "utf8")) as Partial<RoutingOverrideStore>;
    const forceModel = Array.isArray(parsed.forceModel)
      ? parsed.forceModel
          .filter((o): o is RoutingOverride => Boolean(o) && typeof o.question === "string" && o.question.trim().length > 0)
          .map((o) => ({
            question: o.question.trim(),
            normalized: (typeof o.normalized === "string" && o.normalized) || normalizeQuestion(o.question),
            reason: typeof o.reason === "string" ? o.reason : "manual",
            addedAt: typeof o.addedAt === "string" ? o.addedAt : "",
          }))
      : [];
    return { forceModel, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch {
    // A missing or corrupt file simply disables overrides — it never breaks the
    // agent, which keeps its built-in routing.
    return EMPTY;
  }
}

/** The raw questions shipped to the agent (it re-normalizes and matches). */
export function getRoutingOverridesForAgent(): string[] {
  return readRoutingOverrides().forceModel.slice(0, MAX_OVERRIDES).map((o) => o.question);
}

function writeRoutingOverrides(store: RoutingOverrideStore): void {
  const target = contentPath(FILE);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

/**
 * Add a force-model override for a question. Returns true if newly added, false
 * if it was already present or the list is full. Deduped by normalized form.
 */
export function addRoutingOverride(question: string, reason: string): boolean {
  const normalized = normalizeQuestion(question);
  if (!normalized) return false;
  const store = readRoutingOverrides();
  if (store.forceModel.some((o) => o.normalized === normalized)) return false;
  if (store.forceModel.length >= MAX_OVERRIDES) return false;
  const now = new Date().toISOString();
  store.forceModel.unshift({ question: question.trim(), normalized, reason, addedAt: now });
  store.updatedAt = now;
  writeRoutingOverrides(store);
  return true;
}

/** Remove an override (the off-switch / undo). Returns true if one was removed. */
export function removeRoutingOverride(question: string): boolean {
  const normalized = normalizeQuestion(question);
  const store = readRoutingOverrides();
  const next = store.forceModel.filter((o) => o.normalized !== normalized);
  if (next.length === store.forceModel.length) return false;
  writeRoutingOverrides({ forceModel: next, updatedAt: new Date().toISOString() });
  return true;
}

export function isRoutingOverridden(question: string): boolean {
  const normalized = normalizeQuestion(question);
  return readRoutingOverrides().forceModel.some((o) => o.normalized === normalized);
}
