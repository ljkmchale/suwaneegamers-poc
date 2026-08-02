import { NextResponse } from "next/server";
import { getMyraHealth, publicHealthSummary } from "@/lib/myraHealth";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(publicHealthSummary(await getMyraHealth())); }
  catch { return NextResponse.json({ overallStatus: "unknown", summary: "Myra can respond, but her diagnostic service is unavailable.", checkedAt: new Date().toISOString(), capabilities: {} }, { status: 503 }); }
}
