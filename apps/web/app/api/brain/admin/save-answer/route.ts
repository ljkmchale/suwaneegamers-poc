import { NextRequest, NextResponse } from "next/server";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    const sources = Array.isArray(body.sources) ? body.sources as { title: string; heading?: string; score?: number }[] : [];
    const campaign = String(body.campaign ?? "").trim();

    if (!question || !answer) return NextResponse.json({ error: "Missing question or answer." }, { status: 400 });
    if (!campaign || campaign === "All") return NextResponse.json({ error: "Select a specific campaign to save an answer." }, { status: 400 });

    const campaignDir = campaign === "World lore" ? "World" : campaign;
    const slug = question.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
    const dir = path.resolve(brainConfig.vaultRoot, "wiki", "answers", campaignDir);
    if (!isInside(brainConfig.vaultRoot, dir)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });

    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${slug}.md`);
    if (!isInside(brainConfig.vaultRoot, filePath)) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });

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
    return NextResponse.json({ ok: true, path: path.relative(brainConfig.vaultRoot, filePath).replaceAll(path.sep, "/") });
  } catch (error) {
    console.error("[Brain Admin Save Answer]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
