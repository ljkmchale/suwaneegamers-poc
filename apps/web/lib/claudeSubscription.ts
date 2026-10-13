/**
 * Claude through the owner's Claude subscription, for server-side generation.
 *
 * Instead of calling the Messages API with an API key, this drives the Claude
 * Code CLI through the Claude Agent SDK. The CLI authenticates with a
 * subscription login or a long-lived CLAUDE_CODE_OAUTH_TOKEN (from
 * `claude setup-token`), so the usage counts against the plan. It mirrors what
 * the voice worker does (services/livekit-schedule-agent/.../claude_subscription.py).
 *
 * Every call here is a one-shot, tool-less completion: built-in tools are
 * disabled, no settings/CLAUDE.md are loaded, and nothing is persisted. Callers
 * keep their API-key path as the fallback; see `lib/brain/ai-client.ts`.
 *
 * The web server runs as LocalSystem under NSSM, which cannot see a user's
 * `~/.claude` login — set CLAUDE_CODE_OAUTH_TOKEN in the app's env file there.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Vars that would bill an API account or redirect the subscription token. */
const STRIP_FROM_CLI_ENV = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
] as const;

const BUILTIN_TOOLS_DENIED = ["Bash", "Read", "Write", "Edit", "WebFetch", "WebSearch"];

/** After an auth/limit failure, skip the subscription for this long. */
const COOL_DOWN_MS = 5 * 60_000;

type EnvLike = Record<string, string | undefined>;

export type SubscriptionStatus = { enabled: boolean; reason: string };

export class SubscriptionUnavailableError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "limit" | "failed" = "failed",
  ) {
    super(message);
    this.name = "SubscriptionUnavailableError";
  }
}

let unavailableUntil = 0;
let unavailableReason = "";

function configDir(env: EnvLike): string {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  return configured || path.join(os.homedir(), ".claude");
}

/** How the CLI could authenticate right now, without making a request. */
export function credentialKind(env: EnvLike = process.env): "token" | "login" | null {
  if (env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return "token";
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(configDir(env), ".credentials.json"), "utf8"));
    const oauth = raw?.claudeAiOauth;
    if (!oauth) return null;
    if (oauth.refreshToken) return "login";
    if (oauth.accessToken && typeof oauth.expiresAt === "number" && oauth.expiresAt > Date.now() + 60_000) {
      return "login";
    }
  } catch {
    // no readable credentials file
  }
  return null;
}

/** Whether the subscription path should be tried, and why/why not. */
export function subscriptionStatus(env: EnvLike = process.env): SubscriptionStatus {
  const mode = (env.LLM_AUTH ?? "subscription").trim().toLowerCase() || "subscription";
  if (["api", "off", "false", "0"].includes(mode)) return { enabled: false, reason: "LLM_AUTH=api" };
  if (Date.now() < unavailableUntil) {
    return { enabled: false, reason: `cooling down after: ${unavailableReason}` };
  }
  const credential = credentialKind(env);
  if (!credential) {
    return {
      enabled: false,
      reason:
        "no subscription login found (run `claude auth login`, or `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN)",
    };
  }
  return { enabled: true, reason: `subscription via ${credential}` };
}

/** Environment for the CLI subprocess: the process env minus API-billing vars. */
export function subscriptionEnv(env: EnvLike = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if ((STRIP_FROM_CLI_ENV as readonly string[]).includes(key)) continue;
    out[key] = value;
  }
  return out;
}

function neutralCwd(): string {
  const dir = path.join(os.tmpdir(), "claude-subscription-cwd");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resetSubscriptionCooldown(): void {
  unavailableUntil = 0;
  unavailableReason = "";
}

function classify(message: string): "auth" | "limit" | "failed" {
  const text = message.toLowerCase();
  if (/authenticat|401|expired|log in|login|oauth/.test(text)) return "auth";
  if (/rate.?limit|usage limit|429|overloaded|quota/.test(text)) return "limit";
  return "failed";
}

function noteFailure(error: SubscriptionUnavailableError): void {
  if (error.kind === "auth" || error.kind === "limit") {
    unavailableUntil = Date.now() + COOL_DOWN_MS;
    unavailableReason = error.message.slice(0, 120);
  }
}

export type TextRequest = {
  model: string;
  prompt: string;
  system?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type SdkModule = typeof import("@anthropic-ai/claude-agent-sdk");
let sdkPromise: Promise<SdkModule> | null = null;

/** Loaded lazily so a missing optional binary never breaks unrelated routes. */
function loadSdk(): Promise<SdkModule> {
  sdkPromise ??= import("@anthropic-ai/claude-agent-sdk");
  return sdkPromise;
}

type QueryFn = SdkModule["query"];
let queryOverride: QueryFn | null = null;
/** Test seam: replace the SDK's query() without touching the module loader. */
export function setQueryForTests(fn: QueryFn | null): void {
  queryOverride = fn;
}

async function getQuery(): Promise<QueryFn> {
  return queryOverride ?? (await loadSdk()).query;
}

function buildOptions(req: TextRequest, abortController: AbortController) {
  return {
    model: req.model,
    systemPrompt: req.system,
    // [] disables every built-in tool; nothing here may reach a shell or disk.
    tools: [] as string[],
    allowedTools: [] as string[],
    disallowedTools: BUILTIN_TOOLS_DENIED,
    settingSources: [] as never[],
    strictMcpConfig: true,
    includePartialMessages: true,
    maxTurns: 1,
    thinking: { type: "disabled" as const },
    persistSession: false,
    cwd: neutralCwd(),
    env: subscriptionEnv(),
    abortController,
  };
}

function linkAbort(req: TextRequest): { controller: AbortController; dispose: () => void } {
  const controller = new AbortController();
  const timer = req.timeoutMs ? setTimeout(() => controller.abort(), req.timeoutMs) : null;
  const onAbort = () => controller.abort();
  req.signal?.addEventListener("abort", onAbort, { once: true });
  return {
    controller,
    dispose: () => {
      if (timer) clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    },
  };
}

type SdkMessage = {
  type: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  api_error_status?: number | null;
  event?: { type?: string; delta?: { type?: string; text?: string } };
};

function failureFrom(message: SdkMessage): SubscriptionUnavailableError {
  const detail = String(message.result ?? "Claude returned an error");
  const status = message.api_error_status ?? 0;
  let kind = classify(detail);
  if (status === 401 || status === 403) kind = "auth";
  else if (status === 429) kind = "limit";
  return new SubscriptionUnavailableError(detail, kind);
}

/** Stream the text of one completion as it is generated. */
export async function* streamText(req: TextRequest): AsyncGenerator<string> {
  const status = subscriptionStatus();
  if (!status.enabled) throw new SubscriptionUnavailableError(status.reason);
  const query = await getQuery();
  const { controller, dispose } = linkAbort(req);
  try {
    const stream = query({ prompt: req.prompt, options: buildOptions(req, controller) });
    for await (const raw of stream) {
      const message = raw as SdkMessage;
      if (message.type === "stream_event") {
        const delta = message.event?.delta;
        if (message.event?.type === "content_block_delta" && delta?.type === "text_delta" && delta.text) {
          yield delta.text;
        }
      } else if (message.type === "result") {
        if (message.is_error) throw failureFrom(message);
        return;
      }
    }
  } catch (error) {
    if (error instanceof SubscriptionUnavailableError) {
      noteFailure(error);
      throw error;
    }
    const wrapped = new SubscriptionUnavailableError(
      controller.signal.aborted ? "Claude subscription call timed out" : String((error as Error)?.message ?? error),
      classify(String((error as Error)?.message ?? error)),
    );
    noteFailure(wrapped);
    throw wrapped;
  } finally {
    dispose();
  }
}

/** One completion, returned whole. */
export async function generateText(req: TextRequest): Promise<string> {
  let text = "";
  for await (const piece of streamText(req)) text += piece;
  if (!text.trim()) throw new SubscriptionUnavailableError("Claude returned no text", "failed");
  return text;
}
