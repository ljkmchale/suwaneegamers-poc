import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

// Path to the brain-tools indexer (absolute so it works from any cwd)
const INDEXER_PATH = path.resolve(
  process.env.BRAIN_VAULT_ROOT ?? "",
  "..",
  "brain-tools",
  "src",
  "indexer.mjs",
);

export async function POST() {
  try {
    const child = spawn(process.execPath, [INDEXER_PATH], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return NextResponse.json({ ok: true, message: "Reindex started in background." });
  } catch (error) {
    console.error("[Brain Admin Reindex]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
