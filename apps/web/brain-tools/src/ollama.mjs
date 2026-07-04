import { config } from "./config.mjs";

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function embedTexts(texts) {
  const { signal, clear } = withTimeout(30000);
  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.jinaApiKey}`
      },
      body: JSON.stringify({ model: config.embedModel, input: texts }),
      signal
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Jina embed failed (${response.status}): ${detail}`);
    }
    const payload = await response.json();
    return payload.data.map((item) => item.embedding);
  } catch (error) {
    if (error.name === "AbortError") throw Object.assign(new Error("Jina embed timed out."), { statusCode: 504 });
    throw error;
  } finally {
    clear();
  }
}

export async function chat(messages, options = {}) {
  const { signal, clear } = withTimeout(config.chatTimeoutMs);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: config.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        stream: false
      }),
      signal
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Groq chat failed (${response.status}): ${detail}`);
    }
    const payload = await response.json();
    return payload.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error.name === "AbortError") throw Object.assign(new Error("Groq took too long to respond."), { statusCode: 504 });
    throw error;
  } finally {
    clear();
  }
}

export async function* chatStream(messages, options = {}) {
  const { signal, clear } = withTimeout(config.chatTimeoutMs);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: config.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        stream: true
      }),
      signal
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Groq chat failed (${response.status}): ${detail}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        const chunk = JSON.parse(data);
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
    }
  } catch (error) {
    if (error.name === "AbortError") throw Object.assign(new Error("Groq took too long to respond."), { statusCode: 504 });
    throw error;
  } finally {
    clear();
  }
}

export async function keepWarm() {
  // No-op — cloud APIs don't need warm-up pings
}

export async function aiHealth() {
  if (!config.jinaApiKey) return { ok: false, error: "JINA_API_KEY not set" };
  if (!config.groqApiKey) return { ok: false, error: "GROQ_API_KEY not set" };
  return { ok: true, chatModel: config.chatModel, embedModel: config.embedModel };
}
