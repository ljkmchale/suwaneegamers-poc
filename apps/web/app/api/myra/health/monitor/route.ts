import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getMyraHealth } from "@/lib/myraHealth";

function authorized(request: Request): boolean {
  const expected = process.env.SUWANEE_SCHEDULER_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { depth?: unknown };
  const depth = body.depth === "full" ? "full" : "quick";
  const health = await getMyraHealth({ depth, force: true });
  return NextResponse.json({
    overallStatus: health.overallStatus,
    checkedAt: health.checkedAt,
    activeIncidentCount: health.activeIncidents.length,
    websiteUpdates: health.websiteUpdates,
  });
}
