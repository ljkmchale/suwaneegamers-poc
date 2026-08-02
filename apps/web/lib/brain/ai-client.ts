import Anthropic from "@anthropic-ai/sdk";

import { brainConfig } from "./config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatOptions = { temperature?: number };

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// --- Answer generation: Claude primary, Groq fallback -----------------------
// The vault RAG composes its answer from retrieved excerpts with a chat model.
// This used to be Groq (llama-3.3-70b) with no retry, so a single 429 rate limit
// produced a random "the knowledge base did not return an answer" failure. Claude
// (Anthropic SDK) is now primary — the SDK auto-retries 429/5xx with backoff — and
// Groq stays as the fallback if Anthropic is unreachable. Embeddings stay on Jina.

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: brainConfig.anthropicApiKey,
      // The SDK retries 429/5xx/connection errors with exponential backoff. This
      // is the whole reason for the switch — bump it a little above the default 2.
      maxRetries: 3,
    });
  }
  return anthropicClient;
}

function useClaude(): boolean {
  return brainConfig.llmProvider === "claude" && Boolean(brainConfig.anthropicApiKey);
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `${error.status ?? "?"} ${error.name}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// Anthropic takes the system prompt as a separate top-level field and only
// user/assistant turns in `messages`. Callers here send one system + one user
// turn, so fold every system message into the system field and keep the rest.
function toAnthropicMessages(messages: ChatMessage[]): {
  system: string;
  turns: { role: "user" | "assistant"; content: string }[];
} {
  const systemParts: string[] = [];
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of messages) {
    if (message.role === "system") systemParts.push(message.content);
    else turns.push({ role: message.role, content: message.content });
  }
  return { system: systemParts.join("\n\n"), turns };
}

async function chatClaude(messages: ChatMessage[], options: ChatOptions): Promise<string> {
  const { system, turns } = toAnthropicMessages(messages);
  const response = await getAnthropic().messages.create(
    {
      model: brainConfig.anthropicChatModel,
      max_tokens: brainConfig.chatMaxTokens,
      temperature: options.temperature ?? 0.2,
      system: system || undefined,
      messages: turns,
    },
    { timeout: brainConfig.chatTimeoutMs },
  );
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function* chatStreamClaude(
  messages: ChatMessage[],
  options: ChatOptions,
): AsyncGenerator<string> {
  const { system, turns } = toAnthropicMessages(messages);
  const stream = getAnthropic().messages.stream(
    {
      model: brainConfig.anthropicChatModel,
      max_tokens: brainConfig.chatMaxTokens,
      temperature: options.temperature ?? 0.2,
      system: system || undefined,
      messages: turns,
    },
    { timeout: brainConfig.chatTimeoutMs },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { signal, clear } = withTimeout(30000);
  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brainConfig.jinaApiKey}`,
      },
      body: JSON.stringify({ model: brainConfig.embedModel, input: texts }),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Jina embed failed (${response.status}): ${detail}`);
    }
    const payload = await response.json() as { data: { embedding: number[] }[] };
    return payload.data.map((item) => item.embedding);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Jina embed timed out."), { statusCode: 504 });
    }
    throw error;
  } finally {
    clear();
  }
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  if (useClaude()) {
    try {
      return await chatClaude(messages, options);
    } catch (error) {
      console.warn(`[brain] Claude chat failed (${describeError(error)}); falling back to Groq`);
    }
  }
  return chatGroq(messages, options);
}

async function chatGroq(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const { signal, clear } = withTimeout(brainConfig.chatTimeoutMs);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brainConfig.groqApiKey}`,
      },
      body: JSON.stringify({
        model: brainConfig.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        stream: false,
      }),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Groq chat failed (${response.status}): ${detail}`);
    }
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    return payload.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Groq took too long to respond."), { statusCode: 504 });
    }
    throw error;
  } finally {
    clear();
  }
}

export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  if (useClaude()) {
    let emitted = false;
    try {
      for await (const token of chatStreamClaude(messages, options)) {
        emitted = true;
        yield token;
      }
      return;
    } catch (error) {
      // Once tokens have gone out we can't cleanly restart on Groq without
      // duplicating them, so only fall back if Claude failed before any output.
      if (emitted) throw error;
      console.warn(
        `[brain] Claude stream failed before output (${describeError(error)}); falling back to Groq`,
      );
    }
  }
  yield* chatStreamGroq(messages, options);
}

async function* chatStreamGroq(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const { signal, clear } = withTimeout(brainConfig.chatTimeoutMs);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brainConfig.groqApiKey}`,
      },
      body: JSON.stringify({
        model: brainConfig.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        stream: true,
      }),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Groq chat failed (${response.status}): ${detail}`);
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Groq took too long to respond."), { statusCode: 504 });
    }
    throw error;
  } finally {
    clear();
  }
}

export async function aiHealth(): Promise<{ ok: boolean; chatModel?: string; embedModel?: string; error?: string }> {
  if (!brainConfig.jinaApiKey) return { ok: false, error: "JINA_API_KEY not set" };
  if (useClaude()) {
    // Groq may be blank when Claude is primary; that only removes the fallback.
    return { ok: true, chatModel: brainConfig.anthropicChatModel, embedModel: brainConfig.embedModel };
  }
  if (!brainConfig.groqApiKey) {
    return { ok: false, error: "GROQ_API_KEY not set (and Claude is not configured)" };
  }
  return { ok: true, chatModel: brainConfig.chatModel, embedModel: brainConfig.embedModel };
}
