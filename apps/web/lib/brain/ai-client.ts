import { brainConfig } from "./config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatOptions = { temperature?: number };

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
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
  if (!brainConfig.groqApiKey) return { ok: false, error: "GROQ_API_KEY not set" };
  return { ok: true, chatModel: brainConfig.chatModel, embedModel: brainConfig.embedModel };
}
