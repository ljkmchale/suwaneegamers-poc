import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addRoutingOverride,
  getRoutingOverridesForAgent,
  isRoutingOverridden,
  readRoutingOverrides,
  removeRoutingOverride,
} from "@/lib/assistantRoutingOverrides";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-routing-"));
const file = path.join(dir, "assistant-routing-overrides.json");
process.env.SUWANEE_CONTENT_DIR = dir;

beforeEach(() => {
  fs.writeFileSync(file, JSON.stringify({ forceModel: [], updatedAt: "" }));
});
afterAll(() => {
  delete process.env.SUWANEE_CONTENT_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("routing overrides", () => {
  it("adds an override and ships the raw question to the agent", () => {
    expect(addRoutingOverride("What did you learn today?", "misroute-from-general_schedule")).toBe(true);
    expect(getRoutingOverridesForAgent()).toContain("What did you learn today?");
    // Match is by normalized form, so casing/punctuation differences still hit.
    expect(isRoutingOverridden("what did you learn today")).toBe(true);
  });

  it("dedupes by normalized form", () => {
    addRoutingOverride("What did you learn today?", "a");
    expect(addRoutingOverride("what did you LEARN today", "b")).toBe(false);
    expect(readRoutingOverrides().forceModel).toHaveLength(1);
  });

  it("removes an override (the off-switch / undo)", () => {
    addRoutingOverride("How do you work?", "x");
    expect(removeRoutingOverride("how do you work")).toBe(true);
    expect(getRoutingOverridesForAgent()).toHaveLength(0);
  });

  it("a corrupt file disables overrides instead of throwing", () => {
    fs.writeFileSync(file, "{ not valid json");
    expect(getRoutingOverridesForAgent()).toEqual([]);
    expect(isRoutingOverridden("anything")).toBe(false);
  });
});
