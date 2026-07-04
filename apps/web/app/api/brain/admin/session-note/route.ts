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
    const campaign = String(body.campaign ?? "").trim();
    const sessionNum = parseInt(String(body.session ?? ""), 10);
    const text = String(body.text ?? "").trim();

    if (!campaign || campaign === "All") return NextResponse.json({ error: "Select a specific campaign." }, { status: 400 });
    if (!sessionNum || sessionNum < 1 || sessionNum > 999) return NextResponse.json({ error: "Enter a valid session number." }, { status: 400 });
    if (!text || text.length < 3) return NextResponse.json({ error: "Note text is too short." }, { status: 400 });
    if (text.length > 4000) return NextResponse.json({ error: "Note too long (max 4000 characters)." }, { status: 400 });

    const sessionsDir = path.resolve(brainConfig.vaultRoot, "wiki", "sessions", campaign);
    if (!isInside(brainConfig.vaultRoot, sessionsDir)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });

    let files: string[];
    try { files = await fs.readdir(sessionsDir); } catch {
      return NextResponse.json({ error: `No sessions found for "${campaign}".` }, { status: 404 });
    }

    const matchingFile = files.find((f) => new RegExp(`Session\\s+0*${sessionNum}\\b`, "i").test(f));
    if (!matchingFile) return NextResponse.json({ error: `Session ${sessionNum} not found in ${campaign}.` }, { status: 404 });

    const filePath = path.join(sessionsDir, matchingFile);
    if (!isInside(brainConfig.vaultRoot, filePath)) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });

    const existing = await fs.readFile(filePath, "utf8");
    const date = new Date().toISOString().slice(0, 10);
    const bullet = `- ${date}: ${text}\n`;
    const updated = existing.includes("\n## Additional Context")
      ? existing.trimEnd() + "\n" + bullet
      : existing.trimEnd() + "\n\n## Additional Context\n\n" + bullet;

    await fs.writeFile(filePath, updated, "utf8");
    return NextResponse.json({ ok: true, file: matchingFile });
  } catch (error) {
    console.error("[Brain Admin Session Note]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
