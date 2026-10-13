import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  credentialKind,
  generateText,
  resetSubscriptionCooldown,
  setQueryForTests,
  streamText,
  subscriptionEnv,
  subscriptionStatus,
  SubscriptionUnavailableError,
} from "../lib/claudeSubscription";

type Msg = Record<string, unknown>;

function fakeQuery(messages: Msg[], capture?: { options?: Record<string, unknown>; prompt?: string }) {
  return ((params: { prompt: string; options: Record<string, unknown> }) => {
    if (capture) {
      capture.options = params.options;
      capture.prompt = params.prompt;
    }
    return (async function* () {
      for (const message of messages) yield message;
    })();
  }) as never;
}

const delta = (text: string): Msg => ({
  type: "stream_event",
  event: { type: "content_block_delta", delta: { type: "text_delta", text } },
});

describe("claudeSubscription", () => {
  let tempDir: string;
  const saved = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-cfg-"));
    process.env.CLAUDE_CONFIG_DIR = tempDir;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.LLM_AUTH;
    resetSubscriptionCooldown();
  });

  afterEach(() => {
    process.env = { ...saved };
    setQueryForTests(null);
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("detects a token, a refreshable login, and a dead login", () => {
    expect(credentialKind(process.env)).toBeNull();

    fs.writeFileSync(
      path.join(tempDir, ".credentials.json"),
      JSON.stringify({ claudeAiOauth: { accessToken: "a", expiresAt: 1 } }),
    );
    expect(credentialKind(process.env)).toBeNull();

    fs.writeFileSync(
      path.join(tempDir, ".credentials.json"),
      JSON.stringify({ claudeAiOauth: { accessToken: "a", refreshToken: "r", expiresAt: 1 } }),
    );
    expect(credentialKind(process.env)).toBe("login");

    process.env.CLAUDE_CODE_OAUTH_TOKEN = "tok";
    expect(credentialKind(process.env)).toBe("token");
  });

  it("LLM_AUTH=api turns the subscription off even with a token", () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "tok";
    expect(subscriptionStatus().enabled).toBe(true);
    process.env.LLM_AUTH = "api";
    expect(subscriptionStatus()).toEqual({ enabled: false, reason: "LLM_AUTH=api" });
  });

  it("strips API-billing variables from the CLI environment", () => {
    const env = subscriptionEnv({
      PATH: "/bin",
      ANTHROPIC_API_KEY: "sk-secret",
      ANTHROPIC_BASE_URL: "https://elsewhere",
      CLAUDE_CODE_OAUTH_TOKEN: "tok",
    });
    expect(env).toEqual({ PATH: "/bin", CLAUDE_CODE_OAUTH_TOKEN: "tok" });
  });

  it("streams text deltas and runs with no built-in tools", async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "tok";
    process.env.ANTHROPIC_API_KEY = "sk-secret";
    const capture: { options?: Record<string, unknown>; prompt?: string } = {};
    setQueryForTests(
      fakeQuery([delta("Hello "), delta("world."), { type: "result", subtype: "success", is_error: false }], capture),
    );

    const pieces: string[] = [];
    for await (const piece of streamText({ model: "claude-haiku-4-5", system: "Be brief.", prompt: "hi" })) {
      pieces.push(piece);
    }

    expect(pieces.join("")).toBe("Hello world.");
    expect(capture.prompt).toBe("hi");
    const options = capture.options as Record<string, unknown> & { env: Record<string, string> };
    expect(options.tools).toEqual([]);
    expect(options.settingSources).toEqual([]);
    expect(options.persistSession).toBe(false);
    expect(options.systemPrompt).toBe("Be brief.");
    expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("tok");
  });

  it("classifies an auth failure and cools the subscription down", async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "tok";
    setQueryForTests(
      fakeQuery([
        { type: "result", subtype: "success", is_error: true, result: "Failed to authenticate. API Error: 401", api_error_status: 401 },
      ]),
    );

    const failure = await generateText({ model: "m", prompt: "hi" }).catch((e) => e);
    expect(failure).toBeInstanceOf(SubscriptionUnavailableError);
    expect((failure as SubscriptionUnavailableError).kind).toBe("auth");

    const status = subscriptionStatus();
    expect(status.enabled).toBe(false);
    expect(status.reason).toMatch(/cooling down/);
  });

  it("refuses without credentials instead of spawning the CLI", async () => {
    const spy = vi.fn(fakeQuery([]));
    setQueryForTests(spy as never);
    await expect(generateText({ model: "m", prompt: "hi" })).rejects.toBeInstanceOf(
      SubscriptionUnavailableError,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
