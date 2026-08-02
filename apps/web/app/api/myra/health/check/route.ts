import { NextResponse } from "next/server";
import { getMyraHealth } from "@/lib/myraHealth";
import { isHealthAdmin } from "@/lib/myraHealthAuth";
const calls = new Map<string, number>();
export async function POST(request: Request) {
  if (!(await isHealthAdmin())) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const last = calls.get(address) ?? 0;
  if (Date.now() - last < 10_000) return NextResponse.json({ error: "Please wait before running another diagnostic." }, { status: 429 });
  calls.set(address, Date.now());
  const body = await request.json().catch(() => ({})) as { depth?: unknown };
  const depth = body.depth === "full" ? "full" : "quick";
  return NextResponse.json(await getMyraHealth({ depth, force: true }));
}
