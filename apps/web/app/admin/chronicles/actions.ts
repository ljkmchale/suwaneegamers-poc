"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { clearCache } from "@/lib/brain/query-cache";
import { pullGoogleDocToRaw } from "@/lib/brain/google-docs";
import { brainConfig } from "@/lib/brain/config";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

// Path to brain-tools indexer (relative to vault root)
const INDEXER_PATH = path.resolve(brainConfig.vaultRoot, "..", "brain-tools", "src", "indexer.mjs");

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function clearQueryCache(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await clearCache();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function triggerReindex(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const child = spawn(process.execPath, [INDEXER_PATH], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function pullGoogleDoc(
  url: string,
  title: string,
  filename: string,
  overwrite = false,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  await requireAdmin();
  if (!url.trim()) return { ok: false, error: "URL is required." };
  try {
    const result = await pullGoogleDocToRaw({ url, title, filename, overwrite });
    return { ok: true, path: result.relativePath };
  } catch (error) {
    const e = error as Error & { statusCode?: number };
    return { ok: false, error: e.message };
  }
}

export async function saveAnswer(
  question: string,
  answer: string,
  campaign: string,
  sources: { title: string; path: string; heading?: string; score?: number }[],
): Promise<{ ok: boolean; path?: string; error?: string }> {
  await requireAdmin();
  try {
    const campaignDir = campaign === "World lore" ? "World" : campaign;
    const slug = question.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
    const dir = path.resolve(brainConfig.vaultRoot, "wiki", "answers", campaignDir);
    if (!isInside(brainConfig.vaultRoot, dir)) return { ok: false, error: "Invalid campaign." };

    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${slug}.md`);
    if (!isInside(brainConfig.vaultRoot, filePath)) return { ok: false, error: "Invalid file path." };

    const sourceLines = sources.length
      ? sources.map((s) => `- [[${s.title}]]${s.heading ? ` — ${s.heading}` : ""} (score: ${s.score ?? 0})`).join("\n")
      : "None recorded.";

    const content = [
      `---`,
      `title: "${question.replace(/"/g, "'")}"`,
      `campaign: ${campaignDir}`,
      `type: answered-question`,
      `visibility: players`,
      `saved: ${new Date().toISOString().slice(0, 10)}`,
      `---`,
      ``,
      `# ${question}`,
      ``,
      answer,
      ``,
      `## Sources`,
      ``,
      sourceLines,
    ].join("\n");

    await fs.writeFile(filePath, content, "utf8");
    return { ok: true, path: path.relative(brainConfig.vaultRoot, filePath).replaceAll(path.sep, "/") };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function flagAnswer(
  question: string,
  answer: string,
  campaign: string,
  correction: string,
  sources: { title: string; path: string; heading?: string; score?: number }[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    if (!question || !answer) return { ok: false, error: "Missing question or answer." };
    if (!correction) return { ok: false, error: "Add what should be fixed or tested." };

    await fs.mkdir(brainConfig.dataDir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      campaign,
      question,
      answer: answer.slice(0, 8000),
      correction: correction.slice(0, 4000),
      sources,
    };
    await fs.appendFile(path.join(brainConfig.dataDir, "answer-feedback.jsonl"), JSON.stringify(entry) + "\n", "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function appendSessionNote(
  campaign: string,
  session: number,
  text: string,
): Promise<{ ok: boolean; file?: string; error?: string }> {
  await requireAdmin();
  try {
    if (!campaign || campaign === "All") return { ok: false, error: "Select a specific campaign." };
    if (!session || session < 1 || session > 999) return { ok: false, error: "Enter a valid session number." };
    if (!text || text.length < 3) return { ok: false, error: "Note text is too short." };
    if (text.length > 4000) return { ok: false, error: "Note too long (max 4000 characters)." };

    const sessionsDir = path.resolve(brainConfig.vaultRoot, "wiki", "sessions", campaign);
    if (!isInside(brainConfig.vaultRoot, sessionsDir)) return { ok: false, error: "Invalid campaign." };

    let files: string[];
    try { files = await fs.readdir(sessionsDir); } catch {
      return { ok: false, error: `No sessions found for "${campaign}".` };
    }

    const matchingFile = files.find((f) => new RegExp(`Session\\s+0*${session}\\b`, "i").test(f));
    if (!matchingFile) return { ok: false, error: `Session ${session} not found in ${campaign}.` };

    const filePath = path.join(sessionsDir, matchingFile);
    if (!isInside(brainConfig.vaultRoot, filePath)) return { ok: false, error: "Invalid file path." };

    const existing = await fs.readFile(filePath, "utf8");
    const date = new Date().toISOString().slice(0, 10);
    const bullet = `- ${date}: ${text}\n`;
    const updated = existing.includes("\n## Additional Context")
      ? existing.trimEnd() + "\n" + bullet
      : existing.trimEnd() + "\n\n## Additional Context\n\n" + bullet;

    await fs.writeFile(filePath, updated, "utf8");
    return { ok: true, file: matchingFile };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
